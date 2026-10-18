#!/usr/bin/env python3
"""Сквозная проверка тренажёров в headless-браузере.

Запуск:
    python3 -m http.server 8099 &        # из корня репозитория
    python3 tools/smoke.py               # по умолчанию http://127.0.0.1:8099/

Проверяет: все задания решаются ожидаемыми ответами, счётчики сходятся,
страницы переживают испорченный localStorage, диаграмма работает без
захвата указателя (Safari), в консоли нет ошибок.
"""
import math, os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("SMOKE_BASE", "http://127.0.0.1:8099/")
CHROME = os.environ.get("SMOKE_CHROME", "/usr/bin/google-chrome")
fails = []


def ck(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def solve_rows(page, sel, answers, btn="Проверить"):
    rows = page.locator(sel)
    for i, v in enumerate(answers):
        r = rows.nth(i)
        r.scroll_into_view_if_needed()
        r.locator("input").first.fill(str(v))
        r.get_by_role("button", name=btn).click()
    return page.locator(sel + " .verdict.ok").count()


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 834, "height": 1112}, has_touch=True)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        # --- испорченное хранилище не должно ломать страницы
        pg.goto(BASE)
        for junk in ("null", "[1,2,3]", '{"rnd/up-0":5}', "не json"):
            pg.evaluate("v => localStorage.setItem('math-trainers/v1', v)", junk)
            for path, probe in (("percent/", "#lvl1 .card"), ("rounding/", "#lvl1 .card"),
                                ("columnar/", "#lvl1 .board"), ("", "#reset")):
                pg.goto(BASE + path)
                ck(pg.locator(probe).count() > 0, f"{path or 'хаб'} жив при localStorage={junk}")
        pg.evaluate("localStorage.clear()")

        # --- проценты
        pg.goto(BASE + "percent/")
        plan = {2: ["75", "25", "35", "75", "60", "30", "90"],
                3: ["75", "45", "30", "75", "30", "60"],
                4: ["9", "10", "7", "9", "7", "3"],
                5: ["30", "20", "5", "25", "30"],
                6: ["8", "15", "15", "9", "20"]}
        for tab, answers in plan.items():
            pg.locator(".levels button").nth(tab).click()
            got = solve_rows(pg, f"#lvl{tab + 1} .ex", answers)
            ck(got == len(answers), f"проценты, уровень {tab + 1}: {got} из {len(answers)}")
        ck(pg.locator("#score").inner_text() == "Решено 29 из 35", "счётчик процентов сходится")

        # «поставь долю» — крутим диаграмму
        pg.locator(".levels button").nth(1).click()
        for i, target in enumerate([50, 25, 75, 10, 30, 60]):
            cell = pg.locator(".task-cell").nth(i)
            svg = cell.locator("svg").first
            svg.scroll_into_view_if_needed()
            box = svg.bounding_box()
            cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            r = box["width"] * 0.3
            a = (target + 1) / 100 * 2 * math.pi - math.pi / 2
            pg.mouse.move(cx + r * math.cos(a), cy + r * math.sin(a))
            pg.mouse.down(); pg.mouse.up()
            cell.get_by_role("button", name="Проверить").click()
            ck("Верно" in cell.locator(".verdict").inner_text(), f"поставь {target}%")

        # --- округление
        pg.goto(BASE + "rounding/")
        for tab, answers in {1: [5, 8, 3, 6, 10, 2], 2: [4, 8, 3, 6, 2, 9],
                             3: [4, 5, 8, 2, 9, 6], 4: [4, 5, 5, 5, 6, 7]}.items():
            pg.locator(".levels button").nth(tab).click()
            got = solve_rows(pg, f"#lvl{tab + 1} .rt", answers)
            ck(got == len(answers), f"округление, уровень {tab + 1}: {got} из {len(answers)}")
        ck(pg.locator("#score").inner_text() == "Решено 24 из 24", "счётчик округления сходится")

        # --- столбик и уголок: подсказчик доводит каждый пример до конца
        pg.goto(BASE + "columnar/")
        for tab in (1, 3):
            pg.locator(".levels button").nth(tab).click()
            cards = pg.locator(f"#lvl{tab + 1} .pcard")
            for i in range(cards.count()):
                card = cards.nth(i)
                card.scroll_into_view_if_needed()
                clicks = 0
                while clicks < 90:
                    btn = card.get_by_role("button", name="✍️ Записать за меня")
                    if btn.is_disabled():
                        break
                    btn.click(); clicks += 1
                ck("Готово" in card.locator(".say").inner_text(),
                   "столбик: " + card.locator(".title").inner_text())
        ck(pg.locator("#score").inner_text() == "Решено 8 из 8", "счётчик столбика сходится")

        # --- Safari: захват указателя может не сработать
        pg2 = ctx.new_page()
        pg2.add_init_script("Element.prototype.setPointerCapture=function(){throw new Error('no capture')};")
        pg2.goto(BASE + "percent/")
        svg = pg2.locator("#lvl1 svg.pie").first
        box = svg.bounding_box()
        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        r = box["width"] * 0.3
        a = 0.75 * 2 * math.pi - math.pi / 2
        pg2.mouse.move(cx + r * math.cos(a), cy + r * math.sin(a))
        pg2.mouse.down()
        pg2.mouse.move(cx + r * math.cos(a), cy + r * math.sin(a), steps=2)
        pg2.mouse.up()
        ck(svg.get_attribute("aria-valuenow") == "75", "диаграмма крутится без захвата указателя")
        pg2.close()

        ck(not errs, "нет ошибок в консоли" + ("" if not errs else ": " + "; ".join(errs[:3])))
        b.close()

    print("\nпровалов: %d" % len(fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
