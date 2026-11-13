# PRD: Nutrition

**Status:** Decisions recorded 13 Nov 2026. Nothing here is built yet. Features are built one at a time, in the order in section 5. Each one is polished until Ankit is satisfied before the next starts.
**Owner:** Ankit
**Related:**
- [SPEC.md](../SPEC.md): 3.9 is the current placeholder, and §8 lists nutrition as out of scope until now.
- [GLOSSARY.md](../GLOSSARY.md): the terms used below.
- [ADR 0001](adr/0001-open-food-facts-lookups.md): why food lookups go online.

---

## 1. Background

The workout side is done. The Nutrition tab is still a placeholder. This phase adds daily food logging against calorie and macro Targets, for a lifter who eats the same foods most days.

## 2. Goals and non-goals

**Goals**
- **Fast logging** of what was eaten, by Meal, on any past or current Date.
- **Seeing at a glance** how a Date stands against the Targets.
- **Typing a food once:** after the first time it comes from My foods, and works offline.

**Non-goals (this phase)**
- **Not tracked:** water, body weight, other nutrients (fibre, sugar, salt…), and Targets worked out from age, height or weight.
- **Different targets on training days.**
- **Food on the Calendar tab, and food in Export CSV.** Backup already includes food, because it copies the whole database.
- **Moving an Entry between Meals.** Delete it and add it again.
- **Logging on future Dates** (they can be viewed), and planning meals.
- **Units:** ounces and kilojoules.

## 3. Decisions

| # | Decision |
|---|----------|
| D1 | Track calories (kcal) plus protein, carbs and fat (g). |
| D2 | **Targets:**<br>- the user types them on a **Targets** card on More (Calories, Protein, Carbs, Fat);<br>- one set for every Date;<br>- any field can be blank. |
| D3 | **Foods come from three places:**<br>- **My foods**, searched first and offline;<br>- **Open Food Facts**, by text search or barcode;<br>- **Create a food** by hand. |
| D4 | **Every Food you pick is saved to My foods,** whether from a search or a scan. |
| D5 | **A Food stores its nutrition per Serving,** plus the Serving's weight in grams when known. Open Food Facts gives values per 100 g; they are converted to the product's serving size when it has one, and otherwise the Serving is 100 g. |
| D6 | **An Entry's amount** is in Servings (the default) or grams. Grams are only offered when the Food's Serving weight is known. |
| D7 | **An Entry keeps a copy of the Food's name and nutrition** from the moment it was logged. Editing or deleting a Food never changes past Dates. |
| D8 | **A Food log has four fixed Meals:** Breakfast, Lunch, Dinner and Snacks. |
| D9 | **Dates:**<br>- the Nutrition tab uses the existing `WeekStrip` and opens on today;<br>- past Dates can be edited;<br>- future Dates are view-only. |
| D10 | Grams and kcal only, separate from the kg/lb setting. Whole numbers. |
| D11 | **Online search runs only on tap,** never on each keystroke (Open Food Facts allows 10 searches a minute). |
| D12 | **A scan checks My foods by barcode first,** then Open Food Facts. |
| D13 | **A Food is never saved with a blank calorie or macro.** Gaps in an Open Food Facts result are filled in on the food form first. |

## 4. Features

### 4.1 Food log, offline

**What the user sees on the Nutrition tab:**
- the page header, then the week strip, then the summary for the selected Date;
- four Meal sections, each with a header such as "Lunch · 640 kcal" and a **+**;
- the Entries under each header, shown as the food name, the amount, and the kcal.

**Adding an Entry:**
1. **+** on a Meal opens **Add food** for that Meal and Date.
2. A search box filters My foods as you type.
3. **Create a food** sits at the bottom.
4. Picking a food opens the **amount** step:
   - Servings or grams (D6);
   - a live preview of the kcal and macros;
   - **Add**.

**Create a food:** a form with the name, kcal, protein, carbs, fat, and an optional Serving weight in grams. All numbers are required except the Serving weight. The food is saved to My foods.

**Editing an Entry:** tap it to reopen the amount step, already filled in, with **Save** and a "Delete entry" link that asks you to confirm.

**Before Targets exist:** the summary shows plain totals ("1,360 kcal · 120 g protein · …").

### 4.2 Targets

**The Targets card on More:** four number fields.

**The summary at the top of the food log:**
- **Calories:** "1,360 of 2,600 kcal", a bar, and "1,240 left".
- **Macros:** three thin bars for Protein, Carbs and Fat, each showing "120 / 180 g".
- **Over a Target:** the bar is full and the text says "200 over", in the accent colour, not red.
- **A blank Target:** that line shows its total without a bar.
- **No Targets at all:** the plain totals stay, with a "Set targets" link to the card.

### 4.3 Open Food Facts search

**The search:** under the My foods matches, a row reads "Search Open Food Facts for '…'". Results load only when you tap it.

**Picking a result:**
- a result with all its numbers goes to the amount step, and **Add** saves the food to My foods;
- a result with gaps opens the food form first, filled in with what it has, and the gaps are marked (D13).

**Errors:**
- **No connection:** "No connection. Your own foods still work."
- **Rate limit or server error:** "Open Food Facts isn't answering. Try again in a minute."

**Requests** send `User-Agent: <AppName>/<version> (<contact>)`, as Open Food Facts asks.

### 4.4 Barcode scan

- **The barcode button** beside the search box opens the camera. It needs a camera module, so this step needs a new EAS build.
- **A scan checks My foods by barcode first,** then Open Food Facts' product lookup.
- **Found:** it goes on as in 4.3.
- **Not found:** "This barcode isn't in Open Food Facts," with **Create a food**. The new food keeps the barcode, so scanning it again finds it in My foods, offline.
- **Camera permission denied:** a short message, and search still works.

### 4.5 My foods on More

- **The list:** a My foods row on More opens it, sorted A–Z, with a search box.
- **Tap a food** to open the food form, which has **Save** and a "Delete food" link with a confirm.
- **Past Dates are unaffected** by edits and deletes (D7).

## 5. Build order

1. **4.1** Food log, offline.
2. **4.2** Targets.
3. **4.3** Open Food Facts search.
4. **4.4** Barcode scan. This one needs an EAS build.
5. **4.5** My foods on More.

## 6. Open questions for build time

- **Open Food Facts' text-search endpoint.** The legacy `/cgi/search.pl` and the newer Search-a-licious are both options. Check the docs when building 4.3.
- **The `User-Agent` contact.** Decide which contact goes in it (Ankit's choice) before 4.3 ships.
