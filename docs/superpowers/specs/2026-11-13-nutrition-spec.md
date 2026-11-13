# Spec: Nutrition

Source: [PRD-nutrition.md](../../PRD-nutrition.md) (decisions D1–D13), [GLOSSARY.md](../../../GLOSSARY.md) and [ADR 0001](../../adr/0001-open-food-facts-lookups.md). Written 13 Nov 2026.

## Problem Statement

I already log every set in this app. What I eat lives somewhere else, or nowhere. The Nutrition tab is only a placeholder, so I can't see whether I hit my calories and protein on the day I trained. The trackers I could use need an account, push ads, or make me search for the same yogurt every single day.

## Solution

**The Nutrition tab becomes a Food log for each Date:**
- four Meals (Breakfast, Lunch, Dinner, Snacks);
- a summary at the top showing calories and Macros against my own Targets;
- the week strip I already know from Workouts, to move between Dates.

**Adding food:**
- Foods come from **My foods**, a list on the phone that works offline.
- On a miss, I search **Open Food Facts** or scan a barcode.
- Anything not there, I create by hand.
- Every Food I pick is kept in My foods, so I only find it once.

**Entries:** I log each Entry in Servings or grams. An Entry keeps the numbers it was logged with, so my past Dates never change.

## User Stories

**Food log and Dates**
1. As a lifter, I want the Nutrition tab to open on today's Food log, so that I can log what I just ate without navigating.
2. As a lifter, I want the same week strip as the Workouts home on the Nutrition tab, so that moving between Dates feels familiar.
3. As a lifter, I want to tap a past Date and edit its Food log, so that I can add the dinner I forgot to log yesterday.
4. As a lifter, I want future Dates to be viewable but not editable, so that I don't log food into the wrong Date by accident.
5. As a lifter, I want my Food log split into Breakfast, Lunch, Dinner and Snacks, so that I can find an Entry quickly.
6. As a lifter, I want each Meal header to show that Meal's calories, so that I can see where my calories went.
7. As a lifter, I want each Entry to show the food name, the amount and its calories, so that I can check it at a glance.
8. As a lifter, I want an empty Meal to still show its header and **+**, so that I can add to any Meal.

**Adding Entries**
9. As a lifter, I want a **+** on each Meal header, so that the food I add goes straight into that Meal.
10. As a lifter, I want the Add food search to filter My foods as I type, so that I can find a food I eat often in two or three letters.
11. As a lifter, I want My foods search to work without the internet, so that I can log at the gym or on a plane.
12. As a lifter, I want to enter the amount in Servings by default, so that "1 pot of yogurt" is one tap.
13. As a lifter, I want to switch the amount to grams when the Food has a Serving weight, so that I can log weighed chicken exactly.
14. As a lifter, I want a live preview of the calories and Macros while I type the amount, so that I can see what I'm adding before I add it.
15. As a lifter, I want decimal amounts like 1.5 Servings, so that half portions are logged correctly.
16. As a lifter, I want the amount to be required and above zero, so that I can't add an empty Entry.

**Changing Entries**
17. As a lifter, I want to tap an Entry to reopen its amount, already filled in, so that I can fix a wrong amount.
18. As a lifter, I want to delete an Entry with a confirmation, so that a mis-tap doesn't wipe it.
19. As a lifter, I want an Entry to keep the numbers it was logged with, so that fixing a Food today doesn't rewrite my history.

**Creating and managing Foods**
20. As a lifter, I want to create a Food by hand with a name, calories, protein, carbs, fat and an optional Serving weight, so that homemade and restaurant food can be logged.
21. As a lifter, I want calories and every Macro to be required on a Food, so that my totals are never silently missing something.
22. As a lifter, I want a Food I create to go into My foods right away, so that I can log it again tomorrow.
23. As a lifter, I want a My foods row on More, so that I can manage my Foods outside of logging.
24. As a lifter, I want My foods sorted A–Z with a search box, so that I can find a Food in a long list.
25. As a lifter, I want to edit a Food's numbers, so that a wrong label value is fixed for every future Entry.
26. As a lifter, I want to delete a Food I no longer eat, with a confirmation, so that My foods stays short.
27. As a lifter, I want deleting a Food to leave my past Dates as they were, so that cleaning up never loses history.

**Targets**
28. As a lifter, I want a Targets card on More with Calories, Protein, Carbs and Fat, so that I can set the numbers my coach or I chose.
29. As a lifter, I want one set of Targets for every Date, so that I only set them once.
30. As a lifter, I want to leave any Target blank, so that I can track only calories and protein if that's all I care about.
31. As a lifter, I want the summary to show "1,360 of 2,600 kcal" with a bar and "1,240 left", so that I know how much I can still eat.
32. As a lifter, I want three thin bars for Protein, Carbs and Fat showing "120 / 180 g", so that I can see my Macros at a glance.
33. As a lifter, I want going over a Target shown as a full bar and "200 over" in the accent colour, so that a bulk surplus doesn't look like a failure.
34. As a lifter, I want a blank Target to show its total without a bar, so that the summary only tracks what I asked for.
35. As a new user with no Targets, I want plain totals and a "Set targets" link, so that the tab is useful before I set anything up.

**Open Food Facts search**
36. As a lifter, I want a "Search Open Food Facts for '…'" row under my own matches, so that I can find packaged foods I haven't logged before.
37. As a lifter, I want the online search to run only when I tap that row, so that it doesn't use my data or hit the rate limit while I type.
38. As a lifter, I want an Open Food Facts result to show its name and brand, so that I can pick the right product.
39. As a lifter, I want a complete result to go straight to the amount step, so that logging a packaged food takes three taps.
40. As a lifter, I want a picked result saved to My foods when I add it, so that next time it's found offline.
41. As a lifter, I want a result's nutrition shown per its own serving size when it has one, otherwise per 100 g, so that the Servings make sense.
42. As a lifter, I want a result with missing numbers to open the food form first, with the gaps marked, so that I never save a Food with blanks.
43. As a lifter, I want a clear "No connection. Your own foods still work." message, so that I know why search failed and what still works.
44. As a lifter, I want "Open Food Facts isn't answering. Try again in a minute." when the service fails or limits me, so that I know to wait rather than that the app is broken.

**Barcode scan**
45. As a lifter, I want a barcode button beside the search box, so that I can log a packaged food by scanning it.
46. As a lifter, I want a scan to check My foods by barcode first, so that a food I've scanned before is found instantly and offline.
47. As a lifter, I want an unknown barcode to offer Create a food, so that I can still log it.
48. As a lifter, I want a Food I create after a failed scan to keep that barcode, so that scanning it next time finds my own copy.
49. As a lifter, I want a short message if I deny camera access, so that I know why scanning doesn't work and that search still does.

**Units, data and privacy**
50. As a lifter, I want food weights in grams and energy in kcal, whatever my kg/lb setting is, so that food numbers match the labels I read.
51. As a lifter, I want calories and Macros shown as whole numbers, so that the screen isn't cluttered with decimals.
52. As a lifter, I want my Food log, My foods and Targets included in Backup and Restore, so that switching phones keeps my nutrition history.
53. As a lifter, I want only my search text and scanned barcodes to leave the phone, so that the "my data stays on my phone" promise holds for everything I log.

## Implementation Decisions

**Schema (one migration, the next schema version)**
- **A `food` table:**
  - name;
  - kcal, protein, carbs and fat per Serving, all required numbers;
  - Serving weight in grams (optional);
  - barcode (optional, unique when present);
  - created and updated stamps.
- **A `food_entry` table:**
  - the Date, as a local `YYYY-MM-DD` string, the same form `localDateString` gives;
  - the Meal, as one of `breakfast | lunch | dinner | snacks`;
  - an optional link to the Food, set to null when the Food is deleted;
  - a **copy** of the Food's name, per-Serving numbers and Serving weight at the time of logging (D7);
  - the amount, and its unit, `serving | gram`;
  - a created stamp, which sets the order within a Meal.
- **Targets** are four keys in the existing settings table (kcal, protein, carbs, fat), saved through the existing settings save path. A blank Target is a missing key.
- **Backup** needs no change, because it copies the whole database. The backup check in `backupProblem` stays keyed on the workout tables.

**Domain (pure)**
- **Nutrition maths:**
  - an Entry's kcal and Macros come from its copied per-Serving numbers and its amount;
  - grams become Servings by dividing by the Serving weight;
  - totals are summed per Meal and per Date;
  - numbers are rounded to whole values only for display.
- **Target progress:** given a total and an optional Target, it returns the eaten amount, what's left or over, and the bar fraction, capped at 1.

**Repository (the main test seam)**
- **Foods:**
  - create and update, with validation: a non-empty name, the four numbers present and ≥ 0, and a Serving weight > 0 when given;
  - delete;
  - list A–Z with a name filter;
  - find by barcode.
- **Entries:**
  - add one for a Date and Meal from a Food (copying its numbers);
  - change its amount;
  - delete it.
- **Food log read:** the Entries for a Date grouped by Meal, with per-Meal and per-Date totals.
- **Targets:** read and save.

**Open Food Facts**
- **A pure mapper** turns a product JSON into a draft Food:
  - name and brand;
  - nutrition converted from per-100 g to per-Serving when the product gives a serving size in grams, otherwise a 100 g Serving;
  - the barcode;
  - a list of the missing fields.
- **A thin client** sends text search and barcode lookups with the `User-Agent` Open Food Facts asks for. It turns network failure into a "no connection" error and a 503 or 429 into a "not answering" error. Which text-search endpoint to use is checked against the docs at build time.

**Screens (expo-router)**
- **The Nutrition tab** becomes the Food log screen, with the week strip, the summary and four Meal sections.
- **New stack screens:**
  - **Add food**, which takes a Date and a Meal;
  - **amount**, used both to add and to edit an Entry;
  - **food form**, used to create, edit or complete a Food.
- **On More:** a Targets card and a My foods row opening the list.
- **Barcode scanning** uses Expo's camera module, installed with `npx expo install`. It's checked against the SDK 58 docs, and it means a new EAS build.

**Build order** (as in the PRD):
1. food log, offline;
2. Targets;
3. Open Food Facts search;
4. barcode scan;
5. My foods on More.

## Testing Decisions

- **Good tests check behaviour through public functions,** not table layouts or internal helpers. For example: "after editing a Food, yesterday's Food log totals are unchanged". Not: "the `food_entry` row has column X".
- **Seam 1, the repository, against a real SQLite database:**
  - Foods: create, validate, edit, delete, list and filter, find by barcode;
  - Entries: add, change the amount, delete;
  - Food log grouping and totals by Meal and Date;
  - Targets: read, save, and a blank Target;
  - the D7 copy rule;
  - the migration from the current schema version.

  Prior art: `tests/repository.test.ts` with `openTestDb` and `tick`.
- **Seam 2, the pure Open Food Facts mapper,** with saved product JSON samples:
  - complete with a serving size;
  - complete without a serving size;
  - missing Macros;
  - missing everything.

  Prior art: `tests/csv.test.ts`.
- **Nutrition maths and target progress** are pure functions tested alongside them. Prior art: `tests/progress.test.ts`.
- **Screens, the network client and the camera aren't unit-tested.** They're checked in the web preview (the offline features) and on the phone (search and scan), as on the workout side.

## Out of Scope

- **Not tracked:** water, body weight, other nutrients (fibre, sugar, salt…), and Targets worked out from age, height or weight.
- **Different Targets on training days.**
- **Food on the Calendar tab, and food in Export CSV.**
- **Moving an Entry between Meals,** logging on future Dates, and meal planning.
- **Ounces and kilojoules.**
- **Search-as-you-type against Open Food Facts,** and USDA FoodData Central.
- **Contributing data back** to Open Food Facts.

## Further Notes

- **The `User-Agent` contact** for Open Food Facts must be decided by Ankit before 3 (Open Food Facts search) ships.
- **SPEC.md 3.9 and its §8 row** get rewritten as each step lands, the same way the workout features updated SPEC.md.
- **Only search text and barcodes leave the phone.** This is the sole exception to "all data stays on the phone" (ADR 0001).
