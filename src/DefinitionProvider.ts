import * as vscode from 'vscode'

import { jsonPathTo } from './jsonPathTo'

// @ts-ignore
import { parse } from 'json-source-map'

const AnimationController: string = 'AnimationController'
const Animation: string = 'Animation'
const RenderController: string = 'RenderController'
const Geometry: string = 'Geometry'
const Material: string = 'Material'

const Particle: string = 'Particle'
const Texture: string = 'Texture'

const EventIdentifier: string = 'EventIdentifier'
const ComponentGroup: string = 'ComponentGroup'
const Animate: string = 'Animate'

type validPrefixStrings = 'render_controllers' | 'animations' | 'animation_controllers' | 'geometry'
type entityFileTypes = 'minecraft:client_entity' | 'minecraft:entity'

interface descriptionObject {
  description: {
    identifier: string
  }
}

interface behaviourEntity {
  'minecraft:entity': {
    events: {
      [key: string]: object;
    };
    component_groups: {
      [key: string]: object;
    }
  }
}

type sharedDescription = {
  [key in entityFileTypes]: {
    description: {
      animations: {
        [key: string]: object;
      }
    }
  }
}

export default class BedrockDefinitionProvider implements vscode.DefinitionProvider {
  constructor () {}

  async provideDefinition (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | undefined | null> {
    const documentText = this.removeComments(document.getText())

    const editor = vscode.window.activeTextEditor

    if (!editor) return

    const path = jsonPathTo(documentText, editor.document.offsetAt(position))
    const pathKeys = path.map(f => f.key)

    // if there is not more than one level
    if (path.length < 2) return

    let parent = path[path.length - 2].key
    if (parent === undefined && path.length > 3) parent = path[path.length - 3].key
    const key = path[path.length - 1].key

    let parsedDocument: object
    try {
      parsedDocument = parse(documentText)
    } catch (e) {
      return
    }

    const validPrefixes: Array<[ string, string ]> = [
      [AnimationController, 'controller.animation.'],
      [RenderController, 'controller.'],
      [Animation, 'animation.'],
      [Geometry, 'geometry.']
    ]

    const validParents: Array<[ string, string ]> = [
      [Particle, 'particle_effects'],
      [Texture, 'textures'],
      [Material, 'materials'],
      [ComponentGroup, 'component_groups'],
      [Animate, 'animate']
    ]

    let currWordRange = document.getWordRangeAtPosition(position)
    if (currWordRange) {
      let currText = document.getText(currWordRange).toLowerCase()

      // remove quotes
      if (currText.startsWith('"') && currText.endsWith('"')) {
        currWordRange = new vscode.Range(
          currWordRange.start.translate(0, 1),
          currWordRange.end.translate(0, -1),
        )
        currText = document.getText(currWordRange).toLowerCase()
      }

      let type: string = ''
      let isPointerText: boolean = false

      for (let [ prefixType, prefix ] of validPrefixes) {
        if (currText.startsWith(prefix)) {
          type = prefixType
          isPointerText = true
          break
        }
      }

      for (let [ parentType, parentKey ] of validParents) {
        if (parent === parentKey) {
          type = parentType
          isPointerText = true
          break
        }
      }

      if (key === 'event') {
        type = EventIdentifier
        isPointerText = true
      }

      if (isPointerText) {
        let location: vscode.Location | undefined

        if (type === AnimationController) {
          location = await this.handleKeyType(type, 'animation_controllers', currText, 'animation_controllers')
        } else if (type === RenderController) {
          location = await this.handleKeyType(type, 'render_controllers', currText, 'render_controllers')
        } else if (type === Animation) {
          location = await this.handleKeyType(type, 'animations', currText, 'animations')
        } else if (type === Geometry) {
          location = await this.handleGeometry(currText)
        } else if (type === Particle) {
          location = await this.handleParticles(currText)
        }

        // diff types
        if (type === EventIdentifier) {
          location = await this.goToBehaviourDefinition(document, 'events', currText)
        } else if (type === Texture) {
          location = await this.handleTextures(currText)
        } else if (type === Material) {
          location = await this.handleMaterials(currText)
        } else if (type === ComponentGroup && pathKeys.includes('events')) { // check that this is for events
          location = await this.goToBehaviourDefinition(document, 'component_groups', currText)
        } else if (type === Animate && pathKeys.includes('scripts') && pathKeys.includes('animate')) {
          location = await this.goToScriptsAnimate(document, currText)
        }

        if (!location) new vscode.Location(document.uri, currWordRange)

        return location
      }
    }
    return
  }

  private removeComments (text: string): string {
    return text.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '')
  }

  private async getFilesByFolder (folder: string): Promise<vscode.Uri[]> {
    return await vscode.workspace.findFiles(`**/${folder}/**/*.json`)
  }

  private verifyDescriptionIdentifier (description: descriptionObject, identifier: string) {
    if (description['description'] && description['description']['identifier']) {
      if (description['description']['identifier'] === identifier) {
        return true
      }
    }
    return false
  }

  private async handleGeometry (geometryName: string): Promise<vscode.Location | undefined> {
    const models = await this.getFilesByFolder('models')

    for (let modelFile of models) {
      const document = await vscode.workspace.openTextDocument(modelFile)
      const textContent = this.removeComments(document.getText())

      let textContentJSON: {
        format_version: string;
        'minecraft:geometry': Array<descriptionObject>;
        [key: string]: string | Array<object> | {
          [key: string]: object;
        };
      }

      try {
        textContentJSON = JSON.parse(textContent)
      } catch (e) {
        continue
      }
      
      const formatVersion = textContentJSON['format_version']
      const versionParts = formatVersion.split('.')
      const release = Number(versionParts[1])

      if (release) {
        const documentPointers = parse(textContent).pointers
        if (release < 12) {
          // 1.8.0 format
          if (textContentJSON[geometryName]) {
            const path = `/${geometryName}`
            const pointer = documentPointers[path]
            if (pointer) return new vscode.Location(modelFile, new vscode.Position(pointer.key.line, pointer.key.pos))
          }
        } else {
          // 1.12.0 format
          if (textContentJSON['minecraft:geometry'] && textContentJSON['minecraft:geometry'].length > 0) {
            const geometries = textContentJSON['minecraft:geometry']
            for (let i = 0; i < geometries.length; i++) {
              const geometry = geometries[i]
              if (this.verifyDescriptionIdentifier(geometry, geometryName)) {
                const path = `/minecraft:geometry/${i}`
                const pointer = documentPointers[path]
                if (pointer) return new vscode.Location(modelFile, new vscode.Position(pointer.value.line, pointer.value.pos))
              }
            }
          }
        }
      }
    }

    return
  }

  private async handleParticles (particleName: string): Promise<vscode.Location | undefined> {
    const particles = await this.getFilesByFolder('particles')

    for (let particleFile of particles) {
      const document = await vscode.workspace.openTextDocument(particleFile)
      const textContent = this.removeComments(document.getText())

      let textContentJSON: {
        particle_effect: descriptionObject
      }

      try {
        textContentJSON = JSON.parse(textContent)
      } catch (e) {
        continue
      }

      if (textContentJSON['particle_effect']) {
        if (this.verifyDescriptionIdentifier(textContentJSON['particle_effect'], particleName)) {
          const documentPointers = parse(textContent).pointers
          const path = `/particle_effect`
          const pointer = documentPointers[path]
          if (pointer) return new vscode.Location(particleFile, new vscode.Position(pointer.key.line, pointer.key.pos))
        }
      }
    }
    return
  }

  private async handleTextures (path: string): Promise<vscode.Location | undefined> {
    const textures = await vscode.workspace.findFiles(`**/${path}.png`)

    const file = textures[0]
    if (file) {
      return new vscode.Location(file, new vscode.Position(0, 0))
    }

    return
  }

  private async handleKeyType (type: string, prefix: validPrefixStrings, fullName: string, folder: validPrefixStrings): Promise<vscode.Location | undefined> {
    const files = await this.getFilesByFolder(folder)

    for (let file of files) {
      const document = await vscode.workspace.openTextDocument(file)
      const textContent = this.removeComments(document.getText())

      let textContentJSON: {
        [key in validPrefixStrings]: {
          [key: string]: object;
        }
      }

      try {
        textContentJSON = JSON.parse(textContent)
      } catch (e) {
        continue
      }

      if (textContentJSON[prefix][fullName]) {
        const documentPointers = parse(textContent).pointers
        const path = `/${prefix}/${fullName}`
        const pointer = documentPointers[path]
        if (pointer) return new vscode.Location(file, new vscode.Position(pointer.key.line, pointer.key.pos))
      }
    }

    return
  }

  private async handleMaterials (materialName: string): Promise<vscode.Location | undefined> {
    const materials = await vscode.workspace.findFiles(`**/materials/**/*.material`)

    for (let materialFile of materials) {
      const document = await vscode.workspace.openTextDocument(materialFile)
      const textContent = this.removeComments(document.getText())

      let textContentJSON: {
        materials: {
          [key: string]: any
        }
      }

      try {
        textContentJSON = JSON.parse(textContent)
      } catch (e) {
        continue
      }

      if (textContentJSON['materials']) {
        const materialNames = Object.keys(textContentJSON['materials'])
        // find the first key which starts with the material
        const key = materialNames.find(key => key.startsWith(`${materialName}:`))

        const documentPointers = parse(textContent).pointers
        const path = `/materials/${key}`
        const pointer = documentPointers[path]
        if (pointer) return new vscode.Location(materialFile, new vscode.Position(pointer.key.line, pointer.key.pos))
      }
    }
    return
  }

  private async goToBehaviourDefinition (document: vscode.TextDocument, key: 'events' | 'component_groups', definition: string): Promise<vscode.Location | undefined> {
    const documentText = this.removeComments(document.getText())
    const parsedDocument = parse(documentText)
    const documentJSON: behaviourEntity = parsedDocument.data
    if (documentJSON['minecraft:entity']) {
      if (documentJSON['minecraft:entity'][key]) {
        if (documentJSON['minecraft:entity'][key][definition]) {
          const path = `/minecraft:entity/${key}/${definition}`
          const pointer = parsedDocument.pointers[path]
          return new vscode.Location(document.uri, new vscode.Position(pointer.key.line, pointer.key.pos))
        }
      }
    }
    return
  }

  private async goToScriptsAnimate (document: vscode.TextDocument, definition: string): Promise<vscode.Location | undefined> {
    const documentText = this.removeComments(document.getText())
    const parsedDocument = parse(documentText)
    const documentJSON: sharedDescription = parsedDocument.data

    const fileRootType = documentJSON['minecraft:client_entity']
      ? 'minecraft:client_entity'
      : documentJSON['minecraft:entity']
        ? 'minecraft:entity'
        : null

    if (fileRootType && documentJSON[fileRootType]) {
      const fileRoot = documentJSON[fileRootType]
      if (fileRoot && fileRoot['description']) {
        if (fileRoot['description']['animations']) {
          if (fileRoot['description']['animations'][definition]) {
            const path = `/${fileRootType}/description/animations/${definition}`
            const pointer = parsedDocument.pointers[path]
            return new vscode.Location(document.uri, new vscode.Position(pointer.key.line, pointer.key.pos))
          }
        }
      }
    }
    return
  }
}
