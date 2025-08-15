# QuestCraft JSON Schema Guide

Every game in QuestCraft is defined by a single `quest.json` file. This guide provides a detailed reference for all the objects and properties you can use to create your own custom quest.

## Table of Contents
1.  [Root Object: `QuestConfig`](#root-object-questconfig)
2.  [`LocalizedString` Object](#localizedstring-object)
3.  [`ResourceDefinition` Object](#resourcedefinition-object)
4.  [`Board` Object](#board-object)
5.  [`BoardLocation` Object](#boardlocation-object)
6.  [`ChanceCard` / `CommunityChestCard` Object](#chancecard--communitychestcard-object)
7.  [`FooterSection` Object](#footersection-object)
8.  [Pregenerated Scenarios](#pregenerated-scenarios)
9.  [Helper Objects](#helper-objects)

---

## Root Object: `QuestConfig`

The root object contains the entire configuration for the quest.

| Property | Type | Required | Description |
|---|---|:---:|---|
| `name` | `LocalizedString` | Yes | The creative and thematic title of the quest. |
| `description` | `LocalizedString` | Yes | A short, one-sentence tagline describing the quest's theme. |
| `positivity` | `number` | No | A value from 0.0 (dystopian) to 1.0 (optimistic). Affects AI generation tone. Defaults to `0.5`. |
| `groundingInReality` | `boolean` | No | If `true`, the AI will use web search to generate dynamic scenarios based on real-world events. **Note: This requires selecting a search-enabled model in settings.** |
| `resources` | `ResourceDefinition[]` | Yes | An array of 2-4 core resources players manage. |
| `playerColors` | `string[]` | Yes | An array of four Tailwind CSS text color classes for player tokens (e.g., `"text-red-600"`). |
| `board` | `Board` | Yes | The object defining the game board structure. |
| `chanceCards` | `ChanceCard[]` | Yes | An array of 'Chance' cards. |
| `communityChestCards`| `ChanceCard[]` | No | An optional array of 'Community Chest' style cards. |
| `footerSections` | `FooterSection[]` | Yes | Content for informational modals (e.g., Rules, About). |
| `pregeneratedScenarios`| `ScenariosByLocation` | No | A dictionary of pre-written scenarios keyed by location name. |

---

## `LocalizedString` Object

Many user-facing text fields in the schema use a `LocalizedString` object to support internationalization. This object contains key-value pairs where the key is a language code and the value is the translated string.

**Supported Language Codes:**
* `en`: English
* `es`: Spanish
* `hi`: Hindi
* `ta`: Tamil

**Example:**
```json
"name": {
  "en": "My Awesome Quest",
  "es": "Mi Búsqueda Impresionante",
  "hi": "मेरा बहुत बढ़िया खोज",
  "ta": "எனது அற்புதமான குவெஸ்ட்"
}
```
---

## `ResourceDefinition` Object

Defines a single resource that players track.

| Property | Type | Required | Description |
|---|---|:---:|---|
| `name` | `LocalizedString` | Yes | Display name of the resource (e.g., "Money", "Credibility"). |
| `icon` | `string` | Yes | Must be one of: `'MoneyIcon'`, `'TimeIcon'`, or `'InfoIcon'`. |
| `barColor`| `string` | Yes | A Tailwind CSS background color class (e.g., `"bg-green-500"`). |
| `initialValue`| `number` | Yes | The starting value for this resource for all players. |
| `minimumValue`| `number` | No | The value at which a player goes bankrupt if this resource drops to or below it. Defaults to `0`. |
| `maximumValue`| `number` | No | The maximum possible value for this resource. If not set, there is no upper limit. |

---

## `Board` Object

Defines the game board.

| Property | Type | Required | Description |
|---|---|:---:|---|
| `jailPosition` | `number` | Yes | The array index of the 'JAIL' space in the `locations` array. |
| `locations` | `BoardLocation[]` | Yes | An array of location objects. The total number of locations must be a multiple of 4 (e.g., 20, 24, 28) to ensure a square layout. |

---

## `BoardLocation` Object

Defines a single space on the board.

| Property | Type | Required | Description |
|---|---|:---:|---|
| `name` | `LocalizedString` | Yes | The name of the space (e.g., "Local Market", "Server Outage"). |
| `description` | `LocalizedString` | Yes | A short description used by the AI to generate relevant scenarios. |
| `type` | `string` | Yes | The type of space. See `BoardLocationType` values below. |
| `color` | `string` | No | For `'PROPERTY'` spaces, a Tailwind CSS background color class (e.g., `"bg-yellow-600"`). |

### `BoardLocationType` Enum
- `START`
- `PROPERTY` (A space that can trigger a scenario)
- `CHANCE`
- `COMMUNITY_CHEST`
- `UTILITY` (Can also trigger a scenario)
- `TAX`
- `JAIL`
- `FREE_PARKING`
- `GO_TO_JAIL`

---

## `ChanceCard` / `CommunityChestCard` Object

Defines a card that gives a direct outcome.

| Property | Type | Required | Description |
|---|---|:---:|---|
| `description` | `LocalizedString` | Yes | The text displayed on the card. |
| `resourceChanges`| `ResourceChange[]` | Yes | An array of [`ResourceChange`](#resourcechange-object) objects. |

---

## `FooterSection` Object

Defines the content for buttons in the game's footer.

| Property | Type | Required | Description |
|---|---|:---:|---|
| `title` | `LocalizedString` | Yes | The text for the button (e.g., "Rules", "About"). |
| `content` | `LocalizedString` | Yes | The content to display in the modal. Can contain simple HTML like `<strong>` and `<ul>`. |

---

## Pregenerated Scenarios

The `pregeneratedScenarios` object is a dictionary where keys are the `name` of a `BoardLocation` (specifically, the English name) and values are an array of `ManagedScenario` objects. This allows you to write your own branching stories for specific board spaces.

### `ManagedScenario` Object
A scenario is a mini-story with a choice.

| Property | Type | Required | Description |
|---|---|:---:|---|
| `id` | `string` | Yes | A unique identifier for the scenario. |
| `title` | `LocalizedString` | Yes | A short, catchy title for the scenario. |
| `description` | `LocalizedString` | Yes | A paragraph describing the situation. |
| `choices` | `[Choice, Choice]` | Yes | An array containing exactly two `Choice` objects. |
| `sourceUrl` | `string` | No | A URL to a news article or source for "Grounded in Reality" scenarios. |
| `sourceTitle` | `LocalizedString` | No | The title of the source article. |
| `custom` | `boolean` | Yes | `false` for pre-generated, `true` for AI-generated. |
| `enabled` | `boolean` | Yes | Whether the scenario is active. |

### `Choice` Object
| Property | Type | Required | Description |
|---|---|:---:|---|
| `text` | `LocalizedString` | Yes | The text for the choice button. |
| `outcome`| `ChoiceOutcome` | Yes | The result of making this choice. |

### `ChoiceOutcome` Object
| Property | Type | Required | Description |
|---|---|:---:|---|
| `explanation`| `LocalizedString` | Yes | Text explaining the outcome of the choice. |
| `resourceChanges`|`ResourceChange[]`| Yes | An array of [`ResourceChange`](#resourcechange-object) objects defining the resource modifications for this outcome. |

---

## Helper Objects

### `ResourceChange` Object
Defines a change to a single player resource.
| Property | Type | Required | Description |
|---|---|:---:|---|
| `name` | `string` | Yes | The **lowercase English** name of the resource to change. Must match a defined resource. |
| `value` | `number` | Yes | The amount to change the resource by (can be negative). |
**Example:** `[{ "name": "money", "value": 20 }, { "name": "time", "value": -10 }]`