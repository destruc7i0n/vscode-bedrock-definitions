# Change Log

All notable changes to the "vscode-bedrock-definitions" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [2.0.8] - 2022-07-22
- Fixed completions and definitions not populating in JSON files
  - This was due to VSCode [changing the word pattern for JSON](https://code.visualstudio.com/updates/v1_69#_json-word-pattern-change)
- Made resource completions only show resources from the current pack (i.e. behaviour pack animations will not be provided as a completion in resource pack entity files)
  - Made animation completions in `/playanimation` only show resource pack animations
- Stopped showing links for animations and dialogues in `/playanimation` and `/dialogue` respectively (but still provide autocompletions)
- Show definition updating status more prominently

## [2.0.7] - 2022-06-07
- Updated function autocomplete

## [2.0.6] - 2022-06-03
- Made autocomplete for commands not replace text after cursor
- Improved regex for playanimation
- Autocomplete for dialogue command

## [2.0.5] - 2022-06-01
- Support for functions in dialogue files
- Autocomplete for events in the event command
- Autocomplete and go to definition (**file**) for animation
  - Cannot go to animation definition range directly due to limitations of `vscode.DocumentLink`

## [2.0.4] - 2022-03-03
- Support capital letters in fns ([#9](https://github.com/destruc7i0n/vscode-bedrock-definitions/issues/9))
- Support autocomplete with `!` in the entity selector
- Updated entity list to beta 1.18.20.23

## [2.0.2] - 2020-10-13
- Fix text completion

## [2.0.1] - 2020-07-24
- Fix `manifest.json` schema

## [2.0.0] - 2020-07-21

- Reorganize and optimize the codebase
- Added document linking in mcfunction files
  - Go to the function
  - Go to entity defintions and particles
- Added autocompletion in mcfunction files
  - Autocomplete the entity, particle, sound, or function called
  - Autocomplete the entity type in selectors

## [1.0.1] - 2019-10-22

- Added go-to definition and auto complete for sound definitions

## [1.0.0] - 2019-09-10

- Added autocomplete
  - Full list of completions available in the README
- Jump to definition for client entity identifiers, if available
- Rewrite backend to be able to be shared by multiple providers
  - Move to jsonc-parser from json-source-map

## [0.0.2] - 2019-09-05

- Add icon
- Support for jsonc (JSON with comments)

## [0.0.1] - 2019-09-03

- Initial release