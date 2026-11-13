# Food lookups go online to Open Food Facts

The app's promise is that all data stays on the phone. Nutrition breaks that promise for one thing only: finding foods. A search term or a scanned barcode is sent to Open Food Facts. The Food log, My foods and Targets never leave the phone. We chose this so that foods don't all have to be typed off the label. Open Food Facts is the only option that needs no API key and has barcode lookup worldwide.

To keep the online part small:
- a picked Food is saved into My foods, so it is looked up once and works offline from then on;
- a scan checks My foods by barcode before going online;
- online search only runs when the user taps it, never on each keystroke.

## Considered Options

- **USDA FoodData Central.** Accurate for basic foods, but it needs an API key shipped inside the app, it is US-centric, and its barcode coverage outside the US is weak.
- **Typing every food by hand.** Fully offline, but too slow for packaged food. It is kept as the fallback ("Create a food").

## Consequences

- **Search and scan need the internet,** and must fail gracefully: My foods keeps working.
- **Open Food Facts limits apps** to about 10 searches and 15 product reads a minute per IP. Every request must send a custom `User-Agent` in the form `AppName/Version (contact)`.
- **Its data is crowd-sourced (ODbL),** so a result can be missing numbers. The user completes those before the Food is saved.
