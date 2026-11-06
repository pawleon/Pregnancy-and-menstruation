# Reproductive System — expanded, per-chat, story-aware edition (v3.20)

An independently modified SillyTavern extension based on [Pregnancy and Menstruation by delidgi](https://github.com/delidgi/Pregnancy-and-menstruation). Original author and copyright notices remain preserved; see `LICENSE` (AGPL-3.0). This modification was developed in November 2026 and is not an official release by the original developer.

## What's new

- **16 primary contraception choices:** None; external condom; birth control pill; IUD; implant; injection; patch; ring; internal condom; diaphragm; cervical cap; spermicide; withdrawal; fertility awareness/rhythm; historical membrane condom; historical sponge/barrier.
- **Optional second barrier/behavioral method** for each carrier in each chat (for example pill + condom, IUD + condom, implant + condom). The extension forbids the internal + external condom combination. It never adds the effectiveness percentages together.
- **Pill use details:** regular use, one missed active *combined* pill, or two or more missed active pills. The latter flags pill protection as unreliable for the gameplay calculation; a backup method still works. Restoring adherence requires a confirmed RP event or manually changing the control. Only combined pills are represented by these particular rules; progestin-only pills follow different instructions.
- **Implant state and expiry:** active / not inserted / removed / manually expired. Optional "Replace by (RP)" date; the extension compares against the current *roleplay* date, not your phone clock. When a new implant is inserted through a completed RP scene that has an RP_DATE tag, it calculates a default replacement date five years later. You can manually change that date for your fictional world, brand, or historical time period. Without RP time, the calendar cannot auto-expire anything.
- **Automatically respond to explicit scene actions:** new IUD/implant placement, device removal, starting/stopping a method, adding a second method, missed active pills, returning to adherence, and implant expiry can change tracker settings automatically. The AI is asked to emit hidden, structured confirmation markers only when the event has actually happened. A conservative English phrase detector also recognizes completed actions for ongoing methods and encounter-only methods; it does **not** guarantee detection of every phrasing or every LLM's output. If needed, change the dropdown manually.
- **Glowing contraception notifications:** completed RP changes now use the same top-of-screen glowing notification style as pregnancy and menstrual events. Includes starting/stopping methods, missed pills, adding/removing backup methods, implant expiry, and encounter-only barrier use. Manual contraception selection and status changes also show confirmation. Notices respect the global Notifications toggle, do not appear for old events when switching chats, and are deduplicated when SillyTavern processes a message more than once.
- **Reversible scene changes:** the extension replays method changes from the chat transcript so edited, swiped, and deleted RP events do not leave an outdated contraception setting. User-selected manual settings override older events, but newly narrated events can still change the method. Older RP messages are not retroactively interpreted when this version is first installed.
- **Per-chat story settings:** primary and secondary contraception for both user and character; pregnancy length (1–999 weeks); pregnancy carrier; Track Me/Bot/Both; hidden pregnancy; menstruation enabled; universe; Omegaverse designations; baby-tracking duration; cycle realism; trying for a baby; twins/triplets probabilities; configured visibility threshold; and conception/birth lockout flags. Generic appearance, language and notifications stay global.
- **Fantasy pregnancy compatibility:** removes 42-week limits in manual pregnancy tools and pregnancy text recognition. For non-40-week pregnancies, developer milestones and bump visibility scale with configured duration, rather than assuming human weeks. The gestational biology is a fictional approximation; a 4-week vampire pregnancy is not medically realistic human development.

## v3.20: Complete biology, mixed-species inheritance, and Omegaverse cycle update (November 2026)

This is a **single integrated update** covering all ten agreed requirements, not a replacement or removal of the working v3.17–v3.19 contraception system. Please back up chats, extension settings, and the previously working extension before updating. Install/update from a **GitHub repository URL in SillyTavern Extensions**; do not install a duplicate extension with the same manifest.

### Independent Me / Bot biology and Omegaverse

- Each tracked character has separately configurable **biological sex (informational), pregnancy capability, ovulatory cycle, and menstrual bleeding**. Biological sex and Alpha/Beta/Omega designation are independent; no designation automatically decides who can carry or bleed. Existing chats use their former carrier/menstruation defaults until changed. The existing per-chat *Menstruation enabled* checkbox is a master off switch; the per-character **Menstruates** checkboxes choose the individuals when the master is on.
- Per-character **heat/rut schedules**, with *linked to fertile window*, *independent from the menstrual/ovulation cycle*, or *off*. Independently configured cycles use a story-date anchor, frequency (1–365 days), duration, and a selectable simulated fertility effect (*none, boost, or conception only during heat*). Female Omegas can menstruate **and** have heat, or have only heat, as desired; male Omegas and female Alphas are equally configurable. These are fictional roleplay rules, not medicine.
- Me-only, Bot-only and Both tracking hides controls for untracked characters. The legacy **Pregnancy carriers** selector also sets the two independent carry flags; changing an individual carry checkbox updates the legacy selection to match. Appearance settings remain global.
- **Short fantasy cycles:** ovulation and fertile-window calculations avoid a nonsensical fertile window placed inside simulated menstrual bleeding. Cycle notification checks account for RP dates skipping over one or multiple phase boundaries, with notices deduplicated within a time jump. A cycle of 7–365 days and bleeding of 0–30 days remain available (bleeding is capped by cycle length). 
- **Safer story-aware contraception ownership:** hidden event markers identify the exact recipient, and ambiguous natural-language descriptions no longer silently assign an implant, IUD or injection to the wrong person. An appointment scheduled for later is not a completed procedure. All previously supported methods, combinations, renewals, glowing notifications and message-removal rollback remain.

### Pregnancy dates, storage and baby development

- **Pregnancy dating convention** is selectable per chat: legacy weeks *since conception* or conventional **gestational weeks** (approximately two weeks ahead). New pregnancies capture their chosen convention; already-saved pregnancies without a convention retain conception-based dating, without shifting conception dates. The UI displays weeks using that pregnancy's stored convention, while due dates and actual duration use weeks since conception internally. For very short fantasy pregnancies, conception dating is the natural option.
- v3.19's native **per-chat pregnancy, baby and menstrual records** and snapshot rollback remain. Imported chats keep pregnancy state only if the import preserves chat metadata (or a matching legacy ID is available for migration). Duplication creates independent copies; manual pregnancy is suitable for testing per-chat state, while only message-triggered events can test event rollback.
- A baby's **chronological age** remains the time since birth; **developmental age** can use a per-child rate (0.25×–10×, falling back to the per-chat default). The *Baby tracking until* setting can use chronological or developmental age. Milestones and simulated care adjust using the same per-child rate. When children graduate from baby tracking, their names, species, inherited traits, birth dates and developmental rates stay saved in the graduated child record.

### Universal fictional baby inheritance and sex controls

- **No species whitelist or presets.** Parent A (Me) and Parent B (Bot) can be Human, Orc, Elf, Angel, Devil, Mermaid, Siren, a custom original species, or any other name. If both species are known and differ, the child's default is a named hybrid; if a species is missing, it stays unknown instead of defaulting to Human.
- Enter **parent profile traits** per chat: species, hair, eyes, skin/undertone, face, height in centimeters, physical/supernatural traits and abilities. You may paste **explicitly labeled** details and import them with the *Extract labeled fields* button. The extension does **not** reliably infer species or appearance from unlabeled card prose; check and edit the profile yourself.
- When pregnancy starts, each fetus receives its own generated, permanently stored **fictional inheritance**. Siblings, twins and triplets can inherit different combinations. The outcome carries forward into the baby record at birth. This is a simplified random roleplay generator, **not real genetics**; it deliberately does not invent traits missing from both parents. Overrides let you select a different species, hybrid name, appearance, or abilities without rerolling established facts.
- Baby sex remains an independent **M/F random roll** by default. Manual pregnancy can choose all boys, all girls, or enter **one sex per fetus** (`M,F,?` for example). Saved pregnancies allow further per-fetus overrides; existing babies have individual sex and genetics editors. `?` means unknown; it is not silently treated as male. AI story-reveal handling and manual overrides are distinct from physical inheritance.

### Suggested live tests before replacing a working setup

1. Open two temporary chats: set Me to female Omega with independent heat plus menstruation; set Bot to male Omega without bleeding. Check that heat dates and biology remain independent when switching chats.
2. Use a 7-day cycle with 5 bleeding days and a 35-day cycle with 7 bleeding days; check phase labels and story-date jumps. Cycle predictions are gameplay estimates.
3. Set both parent profiles to **Orc** and **Elf**; use *Manual pregnancy* to make twins (`M,F`), deliver manually, and inspect/edit the two babies. Verify species/traits persist after reopening, duplication, and graduation.
4. Select gestational dating for a **new** human pregnancy and check the displayed weeks and due date. Reopen an existing legacy pregnancy and verify it has not shifted.
5. Repeat the previously successful implant/IUD/pill/injection tests, including color-coded notifications and deleting or regenerating a triggering RP message. Confirm the correct recipient is updated.

**Important limitations:** No full SillyTavern browser/device integration test has been completed in this package. Custom ancestry is fiction-first and depends on accurate parent profiles. Physical contraception effectiveness, reproductive hormone patterns and age-related milestones are simplified roleplay mechanics, not clinical advice. Only the `M`/`F`/`?` sex values are modeled, and a completed AI-generated contraceptive event may need a manual correction if a model fails to emit an explicit tag.

## v3.19: Per-chat pregnancy record persistence and migration (November 2026)

- **Pregnancy, baby and menstrual history are saved in native per-chat metadata** (`reproductiveSystem_pregnancyData_v1`), matching the independently stored contraception system. The old global `chatPregnancyData` collection is now read-only migration input.
- **Existing records are copied, not removed:** when a chat is first opened, the extension searches its legacy chat identifiers, deep-copies any matching pregnancy and baby data, and saves the independent copy in that chat's metadata. Do not delete old settings until your migrated chats have been inspected.
- **Chat duplication and imports** copy the pregnancy record as chat-local metadata, rather than sharing a mutable global record based on a chat ID. Later changes in each chat can diverge. An imported legacy chat with no metadata will only recover a record when it matches a legacy identifier.
- **Message rollback stays snapshot-based** and is intentionally distinct from contraception's event ledger. It handles AI-generated pregnancy/conception/birth events; manual pregnancy and baby changes are preserved as user overrides whenever possible. An unrelated deleted message should not erase a deliberately configured pregnancy.
- All existing pregnancy, baby, cycle, and contraception interfaces remain. The normal global settings save is still used for global presentation controls. Pregnancy state now also triggers a per-chat metadata save at normal mutation save points.

### How to test without waiting for conception

1. Back up your chat files and extension settings. Update this extension via the same GitHub repository.
2. Open an **existing** test chat, set a pregnancy manually, and note the weeks and fetus count. Switch to a second chat and confirm it is independent.
3. Return to the first chat and reload SillyTavern. Its pregnancy should still be there.
4. **Duplicate** that test chat. Both copies may initially contain the same pregnancy (that's how duplication works), but editing the pregnancy weeks or baby name in one must not alter the other.
5. Export and import a copy of the test chat. Check that pregnancy data survived; note that imported chat formats which discard SillyTavern chat metadata cannot preserve the metadata-backed state.
6. In a separate temporary chat, trigger a pregnancy through a reproducible RP event or explicit conception/pregnancy tag, then delete or regenerate that triggering message. The resulting RP-driven pregnancy should reverse. Manual pregnancies are *not* a valid substitute for testing message-event rollback.

**Compatibility:** Installing the previous version after v3.19 will not reflect new pregnancy changes saved only in metadata. Keep backups. No existing global data is deleted. This version has passed local automated tests but still requires a live SillyTavern check, especially for chats imported from another device.

## v3.18: Cycle, fantasy biology and historical care update (November 2026)

The following features **extend v3.17**; all existing contraception IDs, pregnancies, babies, and the message-event rollback system remain in place.

- **Separate cycle lengths for Me and Bot, per chat.** Each carrier can have a custom 7–365-day cycle (default 28). Ovulation/estimated fertile days, conception modifiers, phase names, Omegaverse heat/rut labels, day advancement, manual day controls and prompts use the configured length. These calendar estimates are fictional and do not predict real fertility.
- **Separate menstrual bleeding durations for Me and Bot, per chat.** Choose 0–30 days (default 5; internally capped at cycle length). Flow simulation and hygiene reminders use the selected duration. Menstruation enabled/disabled remains a separate per-chat setting.
- **Historical menstrual supplies.** Alongside pads, tampons and cups, the Me/Bot controls now include *reusable menstrual cloth*, *sanitary belt with cloth* (appropriate to later historical periods), *menstrual sponge*, and *None*. They work with the existing simulated hygiene-duration / change reminder system. Availability and hygiene practices varied by era; these are RP options, not safety recommendations.
- **Contraception-aware cycle descriptions.** Active hormonal implants, injections, pills, patches and rings display ovulation as possibly suppressed rather than certain. Bleeding patterns may change; IUD effects depend on type. Pregnancy calculations still use the legacy simplified effectiveness roll, not clinical probabilities.
- **Separate gestation for both carriers.** Me and Bot each have their own 1–999-week pregnancy length. Due-date display, safe birth triggers, pregnancy progress, visibility, complication timing and notifications use the selected term. Fantasy pregnancies receive proportional 25%, 50%, 75% progress notifications instead of inappropriate human-week milestones.
- **Renewal dates for injection / patch / ring.** Completed RP start events with an `RP_DATE` tag can calculate a simplified due date (injection 91 days, patch 7 days, vaginal ring 21 days). Edit either carrier's due date manually. The extension marks protection inactive **after** the due date in *story time* and provides a one-time warning as time advances. For missing RP dates, it does not invent a date; reapplication/renewal requires a confirmed event or manual correction. Implant replacement still supports its own existing date control.
- **Pill adherence remains event-based.** Explicitly missed combined pills affect the tracker. Merely advancing RP time without an established dosing history does **not** silently invent missed doses; a last-confirmed date can indicate that adherence hasn't been established recently.
- **Custom baby developmental speed.** A per-chat multiplier of 0.25×–10× (default 1×) scales developmental milestones, growth-stage labels and modeled care needs, while *chronological age and birth timestamps remain unchanged*. It does not automatically rewrite already-recorded achievements. This is fictional worldbuilding, not pediatric guidance.
- **Conception counters are now per chat.** Check and conception totals shown in the settings represent the current chat's data and participate in the extension's existing state snapshots. Legacy global totals are left untouched for compatibility, but no longer drive the counter display. Existing historical per-chat counts cannot be retroactively reconstructed from old global totals.
- **Baby tracking until: Never** continues to work as a true manual-only option (`0`), rather than accidentally falling back to two years.

### First-time tests for v3.18

1. In two temporary chats, set different Me/character cycle lengths (for example 35 and 21 days), advance RP time, switch away and back, and check that the days and phases persist independently.
2. Set Me pregnancy to 4 weeks and Bot pregnancy to 52 weeks; verify the due dates and progress display are different.
3. Select reusable cloth for a historical scene, then switch to another chat and verify its sanitary kit is unchanged.
4. Try a confirmed contraceptive shot or vaginal ring insertion with an RP_DATE tag, then advance RP time past the configured next renewal and check the status and warning.
5. Preserve the v3.17 checks: implant/IUD/pill/shot RP starts, deletion rollback, second methods and glowing notifications.

**Compatibility caution:** This release passed JavaScript syntax checks and isolated simulation tests, but has **not** been executed in the user's own SillyTavern installation. Back up your current working extension and chat data, and test with a temporary chat before promoting to your public GitHub repository.

## Roleplay event detection

If the AI narrates a **completed** gynecologist visit that installs an IUD for `{{user}}`, it should append (invisibly in chat):

```html
<!-- [CONTRACEPTION_EVENT:{"who":"user","action":"start","method":"iud"}] -->
```

To remove the same IUD:

```html
<!-- [CONTRACEPTION_EVENT:{"who":"user","action":"stop","method":"iud"}] -->
```

Allowed `who` values: `user`, `char`.

| Action | Meaning |
|---|---|
| `start` with method | Completed method start/insertion, replaces primary method |
| `use` with method | Single-encounter barrier/behavioral protection for the current message only |
| `stop` with method | Completed stop/removal (no change if that method isn't selected) |
| `add` with method | Add optional second barrier/behavioral method |
| `remove_backup` | Remove selected second method |
| `miss_one` | Confirmed one missed active combined pill |
| `miss_multiple` | Confirmed two or more missed active combined pills |
| `resume_pills` | Confirmed normal adherence resumed |
| `expire_implant` | Explicitly expired implant |

For implant insertion, `"method":"implant"` can also include `"expires":"2031-11-04"` to specify an exact story replacement date. Otherwise, if the same message contains a valid `RP_DATE`, a five-year gameplay default is used. Natural-language fallback is deliberately limited and cannot identify every subject or procedure reliably.

**No automatic change** for an appointment tomorrow, an IUD merely discussed, a character thinking about getting an implant, a flashback, or an OOC test. An event's actual completed result should be present in the current scene. If the model invents or omits a marker, verify the UI and correct it manually.


## Story-aware detection for all contraception methods

Every primary method supports `start` and `stop` via explicit hidden event markers. The ongoing methods (IUD, implant, pill, shot, patch and vaginal ring) also have conservative English-language detection for clear completed actions, such as a shot being administered or a ring actually inserted. Missed combined-pill actions can also be detected from explicit scenes. Detection is not guaranteed in every language or model output.

**One-time methods:** external/internal condoms, withdrawal, diaphragm, cervical cap, spermicide, fertility awareness, historical condoms and sponges can use `action=use`, which applies for **that message's conception check only** and never changes the persistent dropdown. For example:

```html
<!-- [CONTRACEPTION_EVENT:{"who":"user","action":"use","method":"internal_condom"}] -->
```

The event is only counted when a conception check occurs in the same message. If the encounter continues across several messages, the AI should repeat the scene-use marker in the check message, or you can select the method manually. `start` and `add` remain available for persistent selection (e.g. routinely relying on condoms as backup). Discarded/swiped messages no longer influence persistent changes; a one-time use is never saved as a permanent method. Neither the prompt nor the fallback can guarantee correct understanding of ambiguous roleplay narration; verify tracker changes after important events.

## v3.21 — integrated consistency release

- Independent heat/rut timing uses a dedicated story-date anchor and recurring day counter. It no longer borrows the menstrual cycle day. The first available RP date initializes a blank anchor; before any RP date it displays an unanchored/waiting state. Heat-only conception restrictions apply in Omegaverse, never in Normal mode.
- Pregnancy capability, menstruation, ovulation and heat/rut remain independently configurable for Me and Bot. The old global "menstruation enabled" checkbox is hidden; saved legacy values remain compatible until an explicit per-character choice is made.
- Parent profiles read known traits from the active SillyTavern persona description and current character card. Stored manual profile values win. Extraction is conservative: ambiguous/unlabeled facts remain unknown; no AI/API request is needed. Parent A and B remain available under Track: Me.
- In-progress fetal records can fill missing information after parental traits become available. Known traits and born baby records are **not** regenerated. Automatic and manual births share the same baby genome model.
- The secondary biological parent is recorded from explicit RP evidence/tags or manual entry. The extension does not assume that the current chatbot is necessarily the biological parent.
- Birth dialogs include a labeled baby-name field and readable light-theme typography. The independent baby editor hides when no active baby exists. Birth info and each child's saved sex/species/appearance remain independent.
- Postpartum recovery no longer assumes breastfeeding at birth. When feeding is unknown, menstrual return remains unconfirmed until explicitly established. Per-carrier feeding, estimated/custom/manual cycle-return controls are available; historical pregnancy records are retained.
- Removing a child from active tracking deliberately retains genuine postpartum recovery. **Undo manual delivery** restores the full pre-birth snapshot (including pregnancy and cycle state), even after child tracking was cleared. Explicitly clearing postpartum is a separate action.
- Both pregnancy-length controls use 1–999 week numeric fields and appear only for relevant tracked pregnancy-capable characters. Normal-cycle and postpartum UI no longer present stale cycle days as currently active.

**Compatibility:** Chat options and pregnancy/baby data retain their existing v3.20 metadata keys. This upgrade does not intentionally delete legacy saves. Back up important chats before updating. Contraception scene detection and missed-dose handling remain simplified narrative simulations, not validated real-world risk calculations.

**Limitations:** Free-form appearance parsing cannot guarantee recognition of every persona/card style; edit a missing field manually if needed. New pregnancy dating options do not rewrite existing conception dates. Automatic paternity requires explicit story evidence. A real SillyTavern installation should still be monitored for errors after upgrading, though routine manual test suites are not required.

## Install from GitHub (recommended)

You can install this extension **directly from its GitHub repository URL**. You do not need to download, extract, or copy a ZIP file to install it.

1. Open **SillyTavern** and select **Extensions**.
2. Choose **Install Extension**.
3. Paste the GitHub URL for **this modified extension**
4. Choose a branch if necessary and select whether to install for **the current user** or **all users**.
5. Click **Install**. SillyTavern downloads and loads the extension automatically.
6. Refresh SillyTavern if needed. Open **Extensions** to check that the Reproductive System settings appear.

**First-time test:** Open a temporary RP chat with Notifications enabled, perform a clearly completed contraceptive event (such as an IUD insertion or vaginal ring insertion), and verify that the corresponding dropdown changes **and a glowing confirmation appears**. Test a second chat to confirm that its contraception and pregnancy settings stay independent. Event detection depends on the AI's output and is not guaranteed for every phrasing.

### Updating an existing installation

- If this extension was already installed **from this same GitHub repository**, use the update control under **Extensions → Manage Extensions** when an update is available, then refresh SillyTavern.
- If you are switching from the **original extension or a different repository**, back up your chats/settings and remove the old copy through SillyTavern's extension management before installing this one. **Do not run two copies of the Reproductive System extension at the same time.** Updating an existing clone does not automatically change its repository to a different fork.
- You do not need to manually replace extension folders for ordinary GitHub-based installations and updates.

### For the GitHub repository owner

Place the extension **files at the root of the GitHub repository**: `manifest.json`, `index.js`, `style.css`, `README.md`, and the other JavaScript files must be visible at the top level. If distributing the files from the development ZIP, upload the **contents** of its `Reproductive-system-main` folder, not the folder itself and not the ZIP file. SillyTavern's Git URL installer expects to find `manifest.json` in the installed repository's root.

The roleplay event timeline initializes at the current end of each pre-existing chat, avoiding reinterpretation of old scenes on first install. If a roleplay date is missing, set an implant replacement date manually.

## Data boundaries

- Native SillyTavern `chatMetadata` persists independent contraception and options for every chat; no filename/ID-based shared contraception map.
- Metadata keys: `reproductiveSystem_contraception_v2`, `reproductiveSystem_chatOptions_v1`, `reproductiveSystem_contraceptionDetails_v1`, `reproductiveSystem_contraceptionTimeline_v1`.
- Pregnancy / baby / menstrual data now use `reproductiveSystem_pregnancyData_v1` in per-chat metadata. Old global pregnancy records remain as read-only migration backups; no old keys are deleted.
- Display/notification/UI preferences remain global.

## Gameplay / medical limitations

This is a **fictional RP simulation**, not a validated contraceptive model. The original extension uses contraception effectiveness percentages as event-level dice rolls even though real typical-use failure rates are usually expressed over **one year**. This update improves the implementation of combinations but does *not* convert those estimates into clinically accurate per-encounter pregnancy odds.

Different pill formulations have different missed-dose instructions; this simplified model uses rules for *combined* oral contraceptives only. A complete pill calendar and actual medication intake history are **not** simulated. Implant expiry is based on narrative RP time and a default contemporary Nexplanon-style five-year schedule; other implants and eras may differ. The AI may miss a scene event, so always verify the displayed status. No second hormonal method is supported in the optional second-method dropdown.

Relevant background: [CDC U.S. Selected Practice Recommendations](https://www.cdc.gov/mmwr/volumes/73/rr/rr7303a1.htm) and [FDA Nexplanon 2026 labeling](https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/021529s027lbl.pdf).

## License

Derived from the original project by delidgi. Distributed under **GNU Affero General Public License v3.0 (AGPL-3.0)**, with the original license and attribution retained. Modifications: expanded contraception methods, independent chat settings, AI/scene event processing, configurable reproductive cycles, fantasy gestation and baby development, historical hygiene options, and updated instructions (November 2026).
