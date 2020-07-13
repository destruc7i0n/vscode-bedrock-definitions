# Bedrock Definitions

Go-to Bedrock definitions and auto-complete for Visual Studio Code

## What does it do?
[Video of go-to definition in action](https://streamable.com/k3bel)

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
    - scripts/animate (go to definition in same file)
  - Server (Behaviour) definitions 
    - Animations / Animation Controllers
    - scripts/animate (go to definition in same file)
    - Events (go to the event from the usage in the file)
    - Component Groups (go to component groups from the usage in events)
  - mcfunction files
    - Function called
    - Particles and entities

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
    - Functions
    - Particles and entities

<sub><sup>*If the behaviour pack counterpart is open in the workspace</sup></sub>

## Known Issues

- This will get the first file which has the definition and take you there, so it may not always go to the proper file if there are multiple with the same definition

## Development

To develop, install the packages with `yarn install`, open in Visual Studio Code, and hit F5 to start the development server.

## Contributing

Contributions are welcome!

## License

MIT