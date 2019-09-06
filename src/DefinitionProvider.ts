import * as path from 'path'
 
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
  private document: vscode.TextDocument | undefined

  async provideDefinition (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | undefined> {
    const documentText = document.getText()
    this.document = document

    const editor = vscode.window.activeTextEditor

    if (!editor) return

    const path = jsonPathTo(documentText, editor.document.offsetAt(position))
    const pathKeys = path.map(f => f.key)

    // if there is not more than one level
    if (path.length < 2) return

    // check that in client file, to not perform on the definition itself
    const isClientFile = pathKeys[0] === 'minecraft:client_entity'
    const isBehaviourFile = pathKeys[0] === 'minecraft:entity'

    // only perform in these files for now
    if (!isClientFile && !isBehaviourFile) return

    let parent = path[path.length - 2].key
    if (parent === undefined && path.length > 3) parent = path[path.length - 3].key
    const key = path[path.length - 1].key

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

        if (isClientFile) {
          if (type === RenderController) {
            location = await this.handleKeyType('render_controllers', currText, 'render_controllers')
          } else if (type === Geometry) {
            location = await this.handleGeometry(currText)
          } else if (type === Particle) {
            location = await this.handleParticles(currText)
          } else if (type === Texture) {
            location = await this.handleTextures(currText)
          } else if (type === Material) {
            location = await this.handleMaterials(currText)
          }
        }

        if (isBehaviourFile) {
          if (type === EventIdentifier) {
            location = await this.goToBehaviourDefinition(document, 'events', currText)
          } else if (type === ComponentGroup && pathKeys.includes('events')) { // check that this is for events
            location = await this.goToBehaviourDefinition(document, 'component_groups', currText)
          }
        }

        // works for both
        if (isClientFile || isBehaviourFile) {
          if (type === Animate && pathKeys.includes('scripts') && pathKeys.includes('animate')) {
            location = await this.goToScriptsAnimate(document, currText)
          } else if (type === Animation) {
            location = await this.handleKeyType('animations', currText, 'animations')
          } else if (type === AnimationController) {
            location = await this.handleKeyType('animation_controllers', currText, 'animation_controllers')
          }
        }

        if (!location) new vscode.Location(document.uri, currWordRange)

        return location
      }
    }
    return
  }
  
  /**
   * Orders the provided files by the distance from the current active file
   * @param files the files to order
   */
  private orderByDistance (files: vscode.Uri[]): vscode.Uri[] {
    if (this.document) {
      const currentFile = this.document.fileName
      const sortedFiles = files.sort(({ path: aPath }, { path: bPath }) => {
        // get the closest file basded on the relative location of it and order
        const relativeToA = path.relative(currentFile, aPath).split(path.sep)
        const relativeToB = path.relative(currentFile, bPath).split(path.sep)
        return relativeToA.length - relativeToB.length
      })
      return sortedFiles
    }
    return files
  }

  /**
   * Removes all JavaScript-like comments from the file provided
   * @param text the raw text from the file
   */
  private removeComments (text: string): string {
    return text.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '')
  }

  /**
   * Gets all JSON files from the folder provided
   * @param folder the folder name to get files from
   */
  private async getFilesByFolder (folder: string): Promise<vscode.Uri[]> {
    return this.orderByDistance(await vscode.workspace.findFiles(`**/${folder}/**/*.json`))
  }

  /**
   * Checks the identifier of an object
   * @param description The description object
   * @param identifier The identifier to check for
   */
  private verifyDescriptionIdentifier (description: descriptionObject, identifier: string) {
    if (description['description'] && description['description']['identifier']) {
      if (description['description']['identifier'] === identifier) {
        return true
      }
    }
    return false
  }

  /**
   * Handles geometry files in both formats
   * @param geometryName the geometry name, in the format geometery.
   */
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
          // check for a parented model
          if (!textContentJSON[geometryName]) {
            const parentedModel = Object.keys(textContentJSON).find(k => k.startsWith(`${geometryName}:`))
            if (parentedModel) geometryName = parentedModel
          }
          if (textContentJSON[geometryName]) {
            const path = `/${geometryName}`
            const pointer = documentPointers[path]
            if (pointer) return new vscode.Location(modelFile, new vscode.Position(pointer.keyEnd.line, pointer.keyEnd.pos))
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

  /**
   * Handles particle files
   * @param particleName the particle name, in the format namespace:identifier
   */
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
          if (pointer) return new vscode.Location(particleFile, new vscode.Position(pointer.keyEnd.line, pointer.keyEnd.pos))
        }
      }
    }
    return
  }

  /**
   * Attempts to find the png of the texture at the path provided
   * @param path The path of the texture
   */
  private async handleTextures (path: string): Promise<vscode.Location | undefined> {
    const textures = await vscode.workspace.findFiles(`**/${path}.png`)

    const file = textures[0]
    if (file) {
      return new vscode.Location(file, new vscode.Position(0, 0))
    }

    return
  }

  /**
   * Handles render controllers, animations, animation controllez, etc. which have the same format of files
   * @param prefix The prefix of the key
   * @param fullName The identifier of the key
   * @param folder The folder of the key
   */
  private async handleKeyType (prefix: validPrefixStrings, fullName: string, folder: validPrefixStrings): Promise<vscode.Location | undefined> {
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
        if (pointer) return new vscode.Location(file, new vscode.Position(pointer.keyEnd.line, pointer.keyEnd.pos))
      }
    }

    return
  }

  /**
   * Handles material files
   * @param materialName The material name prefix
   */
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

        if (key) {
          const documentPointers = parse(textContent).pointers
          const path = `/materials/${key}`
          const pointer = documentPointers[path]
          if (pointer) return new vscode.Location(materialFile, new vscode.Position(pointer.keyEnd.line, pointer.keyEnd.pos))
        }
      }
    }

    return
  }

  /**
   * Handles going to/from events and their definition
   * @param document The current document
   * @param key The key to work with
   * @param definition The definition name
   */
  private async goToBehaviourDefinition (document: vscode.TextDocument, key: 'events' | 'component_groups', definition: string): Promise<vscode.Location | undefined> {
    const documentText = this.removeComments(document.getText())
    const parsedDocument = parse(documentText)
    const documentJSON: behaviourEntity = parsedDocument.data
    if (documentJSON['minecraft:entity']) {
      if (documentJSON['minecraft:entity'][key]) {
        if (documentJSON['minecraft:entity'][key][definition]) {
          const path = `/minecraft:entity/${key}/${definition}`
          const pointer = parsedDocument.pointers[path]
          return new vscode.Location(document.uri, new vscode.Position(pointer.keyEnd.line, pointer.keyEnd.pos))
        }
      }
    }
    return
  }

  /**
   * Handles going from scripts/animate to the definition in the animations section
   * @param document The current document
   * @param definition The animation definition
   */
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
            return new vscode.Location(document.uri, new vscode.Position(pointer.keyEnd.line, pointer.keyEnd.pos))
          }
        }
      }
    }

    return
  }
}
