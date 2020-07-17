import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './DescriptionBasedFile'

interface BehaviourEntity {
  'minecraft:entity': {
    [key in 'events' | 'component_groups']: {
      [key: string]: object;
    };
  }
}

export enum BehaviourDefinitionType {
  Events,
  ComponentGroups,
}

class ServerEntityFile extends DescriptionBasedFile {
  type = FileType.ServerEntityIdentifier
  root = 'minecraft:entity'
  glob = `**/entities/**/*.json`

  /**
   * Get a range in the document of a behaviour definition
   * @param document the document
   * @param key the key to get from under
   * @param definition the definition to get
   */
  public async getBehaviourDefinitionInFile (document: vscode.TextDocument, key: BehaviourDefinitionType, definition: string) {
    const { node, data } = await this.getAndParseFileContents(document.uri)

    const keyName = key === BehaviourDefinitionType.Events ? 'events' : 'component_groups'

    if (node && data) {
      const documentJSON: BehaviourEntity = data
  
      if (documentJSON['minecraft:entity']) {
        if (documentJSON['minecraft:entity'][keyName]) {
          if (documentJSON['minecraft:entity'][keyName][definition]) {
            const path = [ 'minecraft:entity', keyName, definition ]
            return this.getFileData(node, path, document, definition)
          }
        }
      }
    }
  }
}

export default ServerEntityFile
