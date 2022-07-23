import * as vscode from 'vscode'

import EditorDocumentHandler from './handlers/EditorDocumentHandler'
import FileHandler, { FileType, BehaviourDefinitionType, LocationData } from './handlers/FileHandler'
import CommandHandler from './handlers/CommandHandler'

import { getCompletionItem, log } from './lib/util'
import { ServerEntityDefinitionFile } from './files'

export default class BedrockProvider implements vscode.DefinitionProvider, vscode.CompletionItemProvider, vscode.DocumentLinkProvider {
  private static fileHandler = new FileHandler()

  /**
   * Purge the inner cache
   */
  public async purgeCache () {
    log('Clearing cache of all resource files...')
    BedrockProvider.fileHandler.emptyCache()
  }

  public async provideDefinition (document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | undefined> {
    const documentHandler = new EditorDocumentHandler(document, position, BedrockProvider.fileHandler)

    if (!documentHandler.shouldHandleSelection()) return

    let location: LocationData | undefined = undefined

    const selectionType = documentHandler.getSelectionType()
    const selectionText = documentHandler.getSelectionText()

    if (!selectionType || !selectionText) return

    // handle any file-specific definitions here
    if (documentHandler.type === FileType.ClientEntityIdentifier) {
      // jumping to the texture file
      switch (selectionType) {
        case FileType.Texture: {
          const texture = await BedrockProvider.fileHandler.getTexture(selectionText)
          if (texture) return new vscode.Location(texture, new vscode.Position(0, 0))
          break
        }
        case FileType.ClientEntityIdentifier: {
          // in client jump to the behaviour def
          documentHandler.setSelectionType(FileType.ServerEntityIdentifier)
          break
        }
        default: break
      }
    } else if (documentHandler.type === FileType.ServerEntityIdentifier) {
      // jumping to the behaviour definitions
      // don't use cached data since I like using this without saving...
      switch (selectionType) {
        // go from event call to the event being called
        case FileType.EventIdentifier: {
          const range = await ServerEntityDefinitionFile.getBehaviourDefinitionInFile(document, BehaviourDefinitionType.Events, selectionText)
          if (range) return new vscode.Location(document.uri, range)
          break
        }
        // want to jump to component group modified
        case FileType.ComponentGroup: {
          if (documentHandler.selection && documentHandler.selection.path.includes('events')) {
            const range = await ServerEntityDefinitionFile.getBehaviourDefinitionInFile(document, BehaviourDefinitionType.ComponentGroups, selectionText)
            if (range) return new vscode.Location(document.uri, range)
          }
          break
        }
        case FileType.ServerEntityIdentifier: {
          // in behaviour jump to the client def
          documentHandler.setSelectionType(FileType.ClientEntityIdentifier)
          break
        }
        default: break
      }
    } else return

    if (!location) {
      const selectionType = documentHandler.getSelectionType()
      const selectionText = documentHandler.getSelectionText()
      const packTypes = documentHandler.getExpectedPackTypes()
      if (!selectionType || !selectionText) return

      const searchResult = await BedrockProvider.fileHandler.findByIndentifier(selectionType, selectionText, packTypes)
      if (searchResult) location = searchResult
    }

    if (location)
      return new vscode.Location(location.uri, location.range)
  }

  public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
    const documentHandler = new EditorDocumentHandler(document, position, BedrockProvider.fileHandler)

    if (documentHandler.shouldHandleCommandCalls()) {
      const commandHandler = new CommandHandler(document)
      return await commandHandler.getCompletionItems(position, BedrockProvider.fileHandler)
    } else if (documentHandler.shouldHandleSelection()) {
      const selectionRange = documentHandler.getSelectionRange()
      const selectionType = documentHandler.getSelectionType()
      if (!selectionType) return

      const expectedPackTypes = documentHandler.getExpectedPackTypes()
      const completionsData = await BedrockProvider.fileHandler.getIdentifiersByFileType(selectionType, expectedPackTypes)
      if (completionsData && selectionRange) {
        const identifiers = [ ...completionsData.keys() ]
        return identifiers.map((id) => getCompletionItem(id, selectionRange, vscode.CompletionItemKind.Field))
      }
    }
  }

  public async provideDocumentLinks (document: vscode.TextDocument): Promise<vscode.DocumentLink[] | undefined> {
    const documentHandler = new EditorDocumentHandler(document, null, BedrockProvider.fileHandler, false)

    if (!documentHandler.shouldHandleCommandCalls()) return

    const commandHandler = new CommandHandler(document)
    return commandHandler.getLinks(BedrockProvider.fileHandler)
  }

  /**
   * Whenever a document is changed in the workspace
   */
  public documentDisposables () {
    const disposableSave = vscode.workspace.onDidSaveTextDocument((document) => {
      const documentHandler = new EditorDocumentHandler(document, null, BedrockProvider.fileHandler)
      if (documentHandler.isResourceDocument()) {
        log(`File has been saved, updating cache...`)
        documentHandler.refreshCurrentDocument()
      }
    })

    const disposableDelete = vscode.workspace.onDidDeleteFiles(({ files }) => {
      for (let file of files) {
        log(`File has been deleted, clearing from cache...`)
        BedrockProvider.fileHandler.deleteFileFromCache(file)
      }
    })

    const logEmptyCacheReason = (action: string) => () => {
      BedrockProvider.fileHandler.emptyCache()
    }

    // on renaming and creation just empty the cache for now
    const disposableRename = vscode.workspace.onDidRenameFiles(logEmptyCacheReason('renamed'))
    const disposableCreate = vscode.workspace.onDidCreateFiles(logEmptyCacheReason('created'))

    return [disposableSave, disposableDelete, disposableRename, disposableCreate]
  }
}