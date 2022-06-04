# Bedrock Definitions

Go-to Bedrock definitions and auto-complete for Visual Studio Code

## Features

- Ctrl (or Cmd on macOS) and hover over definitions to preview the definition in the file
- Ctrl+click (Cmd+click on macOS) or hit F12 to go to the definition file
- Auto-complete for parts of the definition

- Go-to definition works for the following types of definitions
  - Client definitions
    - Entity identifier*
    - Render Controllers
    - Geometry
    - Materials
    - Particle Effects
    - Materials
    - Animations / Animation Controllers
  - Server (Behaviour) definitions 
    - Animations / Animation Controllers
    - Events (go to the event from the usage in the file)
    - Component Groups (go to component groups from the usage in events)
  - mcfunction files
    - Functions
    - Particles
    - Entities
    - Dialogue Files
    - Animation Files

- Auto-complete works for the following types of definitions
  - Client definitions
    - Entity identifier*
    - Render Controllers
    - Geometry
    - Particle Effects
    - Animations / Animation Controllers
  - Server (Behaviour) definitions 
    - Animations / Animation Controllers
  - mcfunction files
    - Functions (`/function`)
    - Particles (`/particle`)
    - Entities (`/summon` and in entity selectors, `@e[type=<entity>]`)
    - Sounds (`/playsound`)
    - Entity Events (`/event entity`)
    - Dialogues (`/dialogue`)
    - Animations (`/playanimation`)

<sub><sup>*If the behaviour pack counterpart is open in the workspace</sup></sub>

## What can it do?
<details>
  <summary>Jump to Definition</summary>
  <img src="https://raw.githubusercontent.com/destruc7i0n/vscode-bedrock-definitions/master/img/preview1.gif" />
  <a href="https://streamable.com/k3bel">Longer video example</a>
</details>
<hr />
<details>
  <summary>Autocomplete</summary>
  <img src="https://raw.githubusercontent.com/destruc7i0n/vscode-bedrock-definitions/master/img/preview2.gif" />
  <a href="https://streamable.com/r33ona">Longer video example</a>
</details>

## Help

You can view the Minecraft documentation at https://bedrock.dev

## Troubleshooting

**The wrong definition is showing**

If you have changed identifiers and they are not being presented to you as definitions etc, save the file which you are editing and try again.

**A lot of definitions/auto completions are incorrect**

You may have done a lot of changes to the structure of your project. 
Open the Command Palette (`Ctrl+Shift+P`) and enter `bedrock definitions`.
Select `Bedrock Definitions: Refresh Cache`.

## Known Issues

- The file you are taken to may not be the desired file

## Development

To develop, install the packages with `yarn install`, open in Visual Studio Code, and hit F5 to start the development server.

## Contributing

Contributions are welcome!
