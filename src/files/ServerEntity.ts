import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { Data, DataType, DataTypeMap, FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './DescriptionBasedFile'

type EntityKeys = 'events' | 'component_groups'
interface BehaviourEntity {
  'minecraft:entity': {
    [key in EntityKeys]: {
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
  title = 'Server Entity'
  root = 'minecraft:entity'
  glob = `**/entities/**/*.json`

  /**
   * Extract the events and component groups as well
   * @param document
   * @param node
   * @param content 
   */
  extract (document: vscode.TextDocument, node: Node, content: BehaviourEntity): DataTypeMap {
    const response: DataTypeMap = super.extract(document, node, content)
    response.set(DataType.ServerEntityEvents, this.extractEvents(document, node, content))
    response.set(DataType.ServerEntityComponentGroups, this.extractComponentGroups(document, node, content))
    return response
  }

  private extractEvents (document: vscode.TextDocument, node: Node, content: BehaviourEntity): Data {
    return this.extractFromObjectKey(content, document, node, 'events')
  }

  private extractComponentGroups (document: vscode.TextDocument, node: Node, content: BehaviourEntity): Data {
    return this.extractFromObjectKey(content, document, node, 'component_groups')
  }

  private extractFromObjectKey (content: BehaviourEntity, document: vscode.TextDocument, node: Node, key: EntityKeys): Data {
    let response: Data = new Map()

    if (content['minecraft:entity'] && content['minecraft:entity'][key]) {
      const events = Object.keys(content['minecraft:entity'][key])
      for (let id of events) {
        const path = [ 'minecraft:entity', key, id ]

        const range = this.getRangeFromPath(node, path, document)
        if (range) {
          response.set(id, { range })
        }
      }
    }

    return response
  }

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
            return this.getRangeFromPath(node, path, document)
          }
        }
      }
    }
  }
}

export default ServerEntityFile
