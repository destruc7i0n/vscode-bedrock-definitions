import * as vscode from 'vscode'

import { findNodeAtLocation } from 'jsonc-parser'

import FileHandler, { validPrefixStrings } from '../lib/FileHandler'

import SharedProvider, { TextType } from './SharedProvider'

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

export default class BedrockDefinitionProvider extends SharedProvider implements vscode.DefinitionProvider {
  public async provideDefinition (document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | undefined> {
    const fileHandler = new FileHandler(document)

    const editor = vscode.window.activeTextEditor
    if (!editor) return

    const { pathKeys } = this.getPathToCursor(document, position)

    // check that in client file, to not perform on the definition itself
    const { isBehaviourFile, isClientFile } = this.getCurrentFileType(pathKeys)

    // only perform in these files for now
    if (!isClientFile && !isBehaviourFile) return

    const { parent, key } = this.getParentAndKey(pathKeys)

    const { currText, currWordRange } = this.getCurrentText(document, position)

    if (currWordRange && currText) {
      const { type, isPointerText } = this.getCurrentTextType(currText, parent, key, pathKeys)

      if (isPointerText) {
        let location: vscode.Location | undefined

        if (isClientFile) {
          if (type === TextType.RenderController) {
            location = await this.byFileType(fileHandler, 'render_controllers', currText)
          } else if (type === TextType.Geometry) {
            location = await this.handleGeometry(fileHandler, currText)
          } else if (type === TextType.Particle) {
            location = await this.byFileType(fileHandler, 'particles', currText)
          } else if (type === TextType.Texture) {
            const texture = await fileHandler.getTexture(currText)
            if (texture) return new vscode.Location(texture.uri, new vscode.Position(0, 0))
          } else if (type === TextType.Material) {
            location = await this.byFileType(fileHandler, 'materials', currText)
          } else if (type === TextType.ClientEntityIdentifier) {
            location = await this.byFileType(fileHandler, 'server_entity', currText)
          }
        }

        if (isBehaviourFile) {
          if (type === TextType.EventIdentifier) {
            location = await this.goToBehaviourDefinition(fileHandler, document, 'events', currText)
          } else if (type === TextType.ComponentGroup && pathKeys.includes('events')) { // check that this is for events
            location = await this.goToBehaviourDefinition(fileHandler, document, 'component_groups', currText)
          } else if (type === TextType.ServerEntityIdentifier) {
            location = await this.byFileType(fileHandler, 'client_entity', currText)
          }
        }

        // works for both
        if (isClientFile || isBehaviourFile) {
          if (type === TextType.Animate && pathKeys.includes('scripts') && pathKeys.includes('animate')) {
            location = await this.goToScriptsAnimate(fileHandler, document, currText)
          } else if (type === TextType.Animation) {
            location = await this.byFileType(fileHandler, 'animations', currText)
          } else if (type === TextType.AnimationController) {
            location = await this.byFileType(fileHandler, 'animation_controllers', currText)
          }
        }

        if (!location) new vscode.Location(document.uri, currWordRange)

        return location
      }
    }
  }

  /**
   * returns the position from the file type
   * @param fileHandler the file handler
   * @param type the type of file
   * @param identifier the identifier to find
   */
  private async byFileType (fileHandler: FileHandler, type: validPrefixStrings | 'particles' | 'server_entity' | 'client_entity', identifier: string): Promise<vscode.Location | undefined> {
    let files, identifiers
    if (type === 'particles') {
      ({ files, identifiers } = await fileHandler.getParticles())
    } else if (type === 'server_entity') {
      ({ files, identifiers } = await fileHandler.getEntities('server'))
    } else if (type === 'client_entity') {
      ({ files, identifiers } = await fileHandler.getEntities('client'))
    } else {
      ({ files, identifiers } = await fileHandler.getByFileType(type))
    }

    if (type === 'materials') {
      const materialName = identifiers.find(key => key.startsWith(`${identifier}:`))
      if (materialName) identifier = materialName
    }

    const identiferIndex = identifiers.indexOf(identifier)
    if (identiferIndex > -1) {
      const file = files[identiferIndex]
      if (file.range) return new vscode.Location(file.uri, file.range)
    }
  }

  /**
   * Handles geometry files in both formats
   * @param fileHandler the file handler
   * @param geometryName the geometry name, in the format geometery.
   */
  private async handleGeometry (fileHandler: FileHandler, geometryName: string): Promise<vscode.Location | undefined> {
    const { files, identifiers } = await fileHandler.getGeometries()

    if (!identifiers.includes(geometryName)) {
      const parentedModel = identifiers.find(k => k.startsWith(`${geometryName}:`))
      if (parentedModel) geometryName = parentedModel
    }

    const identifierIndex = identifiers.indexOf(geometryName)
    if (identifierIndex > -1) {
      const geometry = files[identifierIndex]
      if (geometry.range) return new vscode.Location(geometry.uri, geometry.range)
    }
  }

  /**
   * Handles going to/from events and their definition
   * @param fileHandler the file handler
   * @param document The current document
   * @param key The key to work with
   * @param definition The definition name
   */
  private async goToBehaviourDefinition (fileHandler: FileHandler, document: vscode.TextDocument, key: 'events' | 'component_groups', definition: string): Promise<vscode.Location | undefined> {
    const { node, data } = await fileHandler.getAndParseFileContents(document.uri)

    if (node && data) {
      const documentJSON: behaviourEntity = data
  
      if (documentJSON['minecraft:entity']) {
        if (documentJSON['minecraft:entity'][key]) {
          if (documentJSON['minecraft:entity'][key][definition]) {
            const path = [ 'minecraft:entity', key, definition ]
            const pointer = findNodeAtLocation(node, path)
            if (pointer) return new vscode.Location(document.uri, fileHandler.nodeToRange(document, pointer))
          }
        }
      }
    }
    return
  }

  /**
   * Handles going from scripts/animate to the definition in the animations section
   * @param fileHandler the file handler
   * @param document the current document
   * @param animationName the animation name to go to
   */
  private async goToScriptsAnimate (fileHandler: FileHandler, document: vscode.TextDocument, animationName: string): Promise<vscode.Location | undefined> {
    const { files, identifiers } = await fileHandler.getAnimations(document)

    let animationIndex = identifiers.indexOf(animationName)
    if (animationIndex > -1) {
      const animation = files[animationIndex]
      if (animation.range) return new vscode.Location(document.uri, animation.range)
    }
  }
}
