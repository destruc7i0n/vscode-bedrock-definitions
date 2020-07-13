import * as vscode from 'vscode'

import EditorDocumentHandler from './handlers/EditorDocumentHandler'
import { FileData, FileType, BehaviourDefinitionType } from './handlers/FileHandler'
import CommandHandler from './handlers/CommandHandler'

import ResponseCache from './lib/ResponseCache'

import { getCompletionItem } from './lib/util'

export default class BedrockProvider implements vscode.DefinitionProvider, vscode.CompletionItemProvider, vscode.DocumentLinkProvider {
  private static cache = new ResponseCache()

  private document: vscode.TextDocument | null = null

  /**
   * Checks if the document has changed from the last one being edited
   * Flushes cache if file has changed
   * @param document the document to check with
   */
  private checkForDocumentChange (document: vscode.TextDocument) {
    const documentsAreEqual = this.document && document.fileName === this.document.fileName
    // empty the cache per file on document change
    if (!documentsAreEqual) {
      BedrockProvider.cache.emptyCache()
      this.document = document
    }
  }

  public async provideDefinition (document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | undefined> {
    const documentHandler = new EditorDocumentHandler(document, position, BedrockProvider.cache, true)

    if (documentHandler.isResourceDocument()) this.checkForDocumentChange(document)
    if (!documentHandler.shouldHandleSelection()) return

    let file: FileData | undefined = undefined

    const selectionType = documentHandler.getSelectionType()
    const selectionText = documentHandler.getSelectionText()

    if (!selectionType || !selectionText) return

    // handle any file-specific definitions here
    if (documentHandler.type === FileType.ClientEntityIdentifier) {
      // jumping to the texture file
      switch (selectionType) {
        case FileType.Texture: {
          const texture = await documentHandler.fileSearcher.fileHandler.getTexture(selectionText)
          if (texture) return new vscode.Location(texture.uri, new vscode.Position(0, 0))
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
      const fileHandler = documentHandler.fileSearcher.fileHandler
      // jumping to the behaviour definitions
      switch (selectionType) {
        // go from event call to the event being called
        case FileType.EventIdentifier: {
          file = await fileHandler.getBehaviourDefinitionInCurrentFile(BehaviourDefinitionType.Events, selectionText)
          break
        }
        // want to jump to component group modified
        case FileType.ComponentGroup: {
          if (documentHandler.selection && documentHandler.selection.path.includes('events')) {
            file = await fileHandler.getBehaviourDefinitionInCurrentFile(BehaviourDefinitionType.ComponentGroups, selectionText)
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

    if (!file) {
      const searchResult = await documentHandler.getDefinitionOfSelection()
      if (searchResult) file = searchResult
    }

    if (file)
      return new vscode.Location(file.uri, file.range)
  }

  public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
    const documentHandler = new EditorDocumentHandler(document, position, BedrockProvider.cache, true)
    if (documentHandler.isResourceDocument()) this.checkForDocumentChange(document)

    const commandHandler = new CommandHandler(document)

    if (documentHandler.shouldHandleCommandCalls()) {
      const items = await commandHandler.getCompletionItems(position, documentHandler.fileSearcher)
      return items
    } else if (documentHandler.shouldHandleSelection()) {
      const selectionRange = documentHandler.getSelectionRange()
  
      const completions = await documentHandler.getAllOfSelectionType()
      if (completions && selectionRange)
        return completions.identifiers.map((id) => getCompletionItem(id, selectionRange))
    }
  }

  public async provideDocumentLinks (document: vscode.TextDocument): Promise<vscode.DocumentLink[] | undefined> {
    const documentHandler = new EditorDocumentHandler(document, null, BedrockProvider.cache, false)

    if (documentHandler.isResourceDocument()) this.checkForDocumentChange(document)
    if (!documentHandler.shouldHandleCommandCalls()) return

    const commandHandler = new CommandHandler(document)
    return commandHandler.getLinks(documentHandler.fileSearcher)
  }
}