import { basename } from 'path'

import * as vscode from 'vscode'

import FileHandler, { ResourceFilePackType } from './FileHandler'
import Selection from '../lib/Selection'
import { cleanJson, guessPackTypeFromDocument } from '../lib/util'

import { FileType } from '../handlers/FileHandler'

interface DocumentMapping {
  [key: string]: FileType 
}

class EditorDocumentHandler {
  private document: vscode.TextDocument
  private fileHandler: FileHandler

  public type: FileType = FileType.None
  public selection: Selection | null

  constructor (document: vscode.TextDocument, position: vscode.Position | null, fileHandler: FileHandler, hasSelection: boolean = true) {
    this.document = document

    this.selection = hasSelection && position ? new Selection(document, position) : null
    this.type = this.getDocumentType(document)

    this.fileHandler = fileHandler
  }

  public setSelectionType (type: FileType) {
    if (this.selection?.type) this.selection.setType(type)
  }

  /**
   * Returns the type of the current selection
   */
  public getSelectionType () {
    return this.selection?.type
  }

  /**
   * Returns the currently selected text
   */
  public getSelectionText () {
    return this.selection?.text
  }

  /**
   * Returns the range of the selection
   */
  public getSelectionRange () {
    return this.selection?.range
  }

  public getExpectedPackTypes (): ResourceFilePackType[] | undefined {
    const selectionType = this.getSelectionType()
    const documentPackType = this.getDocumentPackType()

    // always show unknown ones
    const expectedPackTypes = [ ResourceFilePackType.Unknown ]

    // try and only get items that have the same pack type as the current document
    switch (selectionType) {
      case FileType.Animation:
      case FileType.AnimationController: {
        expectedPackTypes.push(documentPackType)
        break
      }
      default: {
        break
      }
    }

    if (expectedPackTypes.length > 1) return expectedPackTypes
  }

  /**
   * Checks if the current document can be parsed based on selection
   */
  public shouldHandleSelection () {
    return this.selection
          && [FileType.ClientEntityIdentifier, FileType.ServerEntityIdentifier].includes(this.type)
          && this.selection.type !== FileType.None
  }

  /**
   * Checks if the document can be handled for command related stuff
   */
  public shouldHandleCommandCalls () {
    return [
      FileType.McFunction,
      FileType.Animation,
      FileType.AnimationController,
      FileType.Dialogue,
    ].includes(this.type)
  }

  /**
   * Returns whether or not the current document is a resource definition file
   */
  public isResourceDocument () {
    return ![FileType.None, FileType.McFunction].includes(this.type)
  }

  /**
   * Guesses the pack type of the current document
   * @returns the current document's pack type
   */
  public getDocumentPackType () {
    return guessPackTypeFromDocument(this.document)
  }

  /**
   * Refresh the current document in the cache
   */
  public refreshCurrentDocument () {
    this.fileHandler.refreshCacheForFile(this.document.uri)
  }

  /**
   * Determines the file type of the JSON file specified
   */
  private getDocumentType (document: vscode.TextDocument) {
    let type: FileType = FileType.None

    const fileName = basename(document.fileName)

    // check that in client file, to not perform on the definition itself
    if (fileName.endsWith('.json') || fileName.endsWith('.material')) {
      // don't use jsonc-parser to save time
      const content = cleanJson(document.getText())

      if (!content) return type

      const fileNameBasedAssoc: DocumentMapping = {
        'sound_definitions.json': FileType.SoundEffect,
      }
      
      const fileNameAssoc = fileNameBasedAssoc[fileName]
      if (fileNameAssoc) return fileNameAssoc

      const keys = Object.keys(content)
      // this is not a minecraft document
      if (keys.includes('format_version') || keys.includes('materials')) {
        const pathRoots: DocumentMapping = {
          'minecraft:client_entity': FileType.ClientEntityIdentifier,
          'minecraft:entity': FileType.ServerEntityIdentifier,
          'minecraft:block': FileType.Block,
          'minecraft:geometry': FileType.Geometry,
          'minecraft:npc_dialogue': FileType.Dialogue,
          'animations': FileType.Animation,
          'animation_controllers': FileType.AnimationController,
          'render_controllers': FileType.RenderController,
          'particle_effect': FileType.Particle,
          'sound_definitions': FileType.SoundEffect,
          'materials': FileType.Material,
        }
  
        for (let pathRoot of Object.keys(pathRoots)) {
          if (keys.includes(pathRoot)) {
            type = pathRoots[pathRoot]
          }
        }
    
        if (type === FileType.None) {
          const isOlderGeometry = keys.some((k) => k.startsWith('geometry.'))
          if (isOlderGeometry) type = FileType.Geometry
        }
      }
    } else if (fileName.endsWith('.mcfunction')) type = FileType.McFunction

    return type
  }
}

export default EditorDocumentHandler
