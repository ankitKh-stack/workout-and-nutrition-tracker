# Workout and Nutrition Tracker

A private phone log for people who lift: the workouts they train and the food they eat.

## Workouts

**Day**:
A named workout template the user trains, such as "Push Day". Never a calendar date.
_Avoid_: Routine, split, template

## Nutrition

**Date**:
A calendar day, as in the food eaten on 13 Nov 2026.
_Avoid_: Day (that is a workout template)

**Food log**:
Everything the user ate on one Date, grouped into Meals.
_Avoid_: Diary, nutrition day

**Meal**:
One of four fixed groups within a Food log: Breakfast, Lunch, Dinner, Snacks.
_Avoid_: Eating occasion, slot

**Food**:
Something the user eats, with a name, nutrition and serving size, kept on the phone once picked.
_Avoid_: Item, product, ingredient

**My foods**:
The user's own list of saved Foods, usable without the internet.
_Avoid_: Library, pantry, favourites

**Serving**:
The portion a Food's nutrition is given for, with its weight in grams when known.
_Avoid_: Portion, unit

**Entry**:
One Food in a Meal of a Food log, with the amount eaten in Servings or grams.
_Avoid_: Log item, food item, record

**Open Food Facts**:
The free online food database used to find Foods by name or barcode.
_Avoid_: OFF, the API, food database

**Macros**:
Protein, carbs and fat, counted in grams.
_Avoid_: Macronutrients, nutrients

**Target**:
The user's own daily goal for calories and each Macro, typed in by hand and the same on every Date.
_Avoid_: Goal, budget, limit
