import * as vscode from 'vscode'

import * as path from 'path'

import { findNodeAtLocation, parseTree, parse, Node } from 'jsonc-parser'

/**
 * The various types of files
 */

export enum FileType {
  None,
  AnimationController,
  Animation,
  RenderController,
  Geometry,
  Material,
  Particle,
  Texture,
  ClientEntityIdentifier,
  ServerEntityIdentifier,
  EventIdentifier,
  ComponentGroup,
  Animate,
  SoundEffect,

  McFunction,
}

export type EntityFileType = FileType.ServerEntityIdentifier | FileType.ClientEntityIdentifier
type SimilarFormatFileTypes = FileType.Material | FileType.Animation | FileType.AnimationController | FileType.RenderController | FileType.Particle | FileType.SoundEffect

export enum BehaviourDefinitionType {
  Events,
  ComponentGroups,
}

export type FileData = {
  uri: vscode.Uri
  name: string
  range: vscode.Range
}

export type FilesSearchResponse = {
  files: FileData[]
  identifiers: string[]
}

interface DescriptionObject {
  description: {
    identifier: string
  }
}

interface BaseFile {
  format_version: string
}

interface GeometryFile extends BaseFile {
  // 1.12 format
  'minecraft:geometry': DescriptionObject[]
  // 1.8 format
  [key: string]: string | object[] | {
    [key: string]: object
  }
}

interface ParticleFile extends BaseFile {
  particle_effect: DescriptionObject
}

type MultiFileType = BaseFile & {
  [key: string]: {
    [key: string]: any
  }
}

type EntityDefinitionFile = BaseFile & {
  [key in 'minecraft:client_entity' | 'minecraft:entity']: DescriptionObject
}

interface BehaviourEntity {
  'minecraft:entity': {
    events: {
      [key: string]: object;
    };
    component_groups: {
      [key: string]: object;
    }
  }
}

export default class FileHandler {
  private document: vscode.TextDocument

  constructor (document: vscode.TextDocument) {
    this.document = document
  }

  /**
   * Converts the node to a range
   * @param document the document
   * @param node the node
   */
  private nodeToRange (document: vscode.TextDocument, node: Node): vscode.Range {
    const offset = node!.offset
    const start = document.positionAt(offset + 1)
    const end = document.positionAt(offset + (node!.length - 1))
    return new vscode.Range(start, end)
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
   * Get and order the files from the glob pattern provided
   * @param glob the glob to find files from
   */
  private async getFilesFromGlob (glob: vscode.GlobPattern): Promise<vscode.Uri[]> {
    return this.orderByDistance(await vscode.workspace.findFiles(glob))
  }

  /**
   * Verify that there is a description and identifier on an object
   * @param description The description object to verify
   */
  private verifyDescriptionIdentifier (description: DescriptionObject) {
    return description['description'] && description['description']['identifier']
  }

  /**
   * Open and parse (with source-maps) the file specified
   * @param file the file to parse
   */
  private async getAndParseFileContents (file: vscode.Uri): Promise<{node: Node | null, data: any, document: vscode.TextDocument}> {
    const document = await vscode.workspace.openTextDocument(file)
    const textContent = document.getText()

    try {
      return {
        document,
        data: parse(textContent),
        node: parseTree(textContent)
      }
    } catch (e) {
      return {
        document,
        data: null,
        node: null
      }
    }
  } 

  /**
   * Get a range in the current document of a behaviour definition
   * @param key the key to get from under
   * @param definition the definition to get
   */
  public async getBehaviourDefinitionInCurrentFile (key: BehaviourDefinitionType, definition: string): Promise<FileData | undefined> {
    const { node, data } = await this.getAndParseFileContents(this.document.uri)

    const keyName = key === BehaviourDefinitionType.Events ? 'events' : 'component_groups'

    if (node && data) {
      const documentJSON: BehaviourEntity = data
  
      if (documentJSON['minecraft:entity']) {
        if (documentJSON['minecraft:entity'][keyName]) {
          if (documentJSON['minecraft:entity'][keyName][definition]) {
            const path = [ 'minecraft:entity', keyName, definition ]
            const pointer = findNodeAtLocation(node, path)
            if (pointer) {
              return {
                uri: this.document.uri,
                name: definition,
                range: this.nodeToRange(this.document, pointer)
              }
            }
          }
        }
      }
    }
  }

  /**
   * Get the geometry identifiers, following both 1.8 and 1.12 schemas
   */
  public async getGeometries (): Promise<FilesSearchResponse> {
    const geometryFiles = await this.getFilesFromGlob('**/models/**/*.json')

    let geometries = []
    let geometryIdentifiers = []

    for (let geometryFile of geometryFiles) {
      const { node, data, document } = await this.getAndParseFileContents(geometryFile)
      if (node && data) {
        const documentJSON: GeometryFile = data

        const formatVersion = documentJSON['format_version']
        if (formatVersion) {
          const versionParts = formatVersion.split('.')
          const release = Number(versionParts[1])
  
          if (release) {
            if (release < 12) {
              for (let geometry of Object.keys(documentJSON)) {
                if (geometry.startsWith('geometry.')) {
                  let path = [ geometry ]
                  const pointer = findNodeAtLocation(node, path)
                  if (pointer) {
                    geometries.push({
                      uri: geometryFile,
                      name: geometry,
                      range: this.nodeToRange(document, pointer)
                    })
                    geometryIdentifiers.push(geometry)
                  }
                }
              }
            } else {
              // 1.12.0 format
              if (documentJSON['minecraft:geometry']) {
                const documentGeometries = documentJSON['minecraft:geometry']
                for (let i = 0; i < documentGeometries.length; i++) {
                  const geometry = documentGeometries[i]
                  const identifier = this.verifyDescriptionIdentifier(geometry)
                  if (identifier) {
                    let path = [ 'minecraft:geometry', i ]
                    const pointer = findNodeAtLocation(node, path)
                    if (pointer) {
                      geometries.push({
                        uri: geometryFile,
                        name: identifier,
                        range: this.nodeToRange(document, pointer)
                      })
                      geometryIdentifiers.push(identifier)
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      files: geometries,
      identifiers: geometryIdentifiers
    }
  }

  /**
   * Get the particle identifiers
   */
  public async getParticles (): Promise<FilesSearchResponse> {
    const particleFiles = await this.getFilesFromGlob('**/particles/**/*.json')

    let particles = []
    let particleIdentifiers = []

    for (let particleFile of particleFiles) {
      const { node, data, document } = await this.getAndParseFileContents(particleFile)
      if (node && data) {
        const documentJSON: ParticleFile = data

        if (documentJSON['particle_effect']) {
          const identifier = this.verifyDescriptionIdentifier(documentJSON['particle_effect'])
          if (identifier) {
            const path = [ 'particle_effect' ]
            const pointer = findNodeAtLocation(node, path)
            if (pointer) {
              particles.push({
                uri: particleFile,
                name: identifier,
                range: this.nodeToRange(document, pointer)
              })
              particleIdentifiers.push(identifier)
            }
          }
        }
      }
    }

    return {
      files: particles,
      identifiers: particleIdentifiers
    }
  }

  /**
   * Get the identifiers from files following the same style
   * @param type the type of file to get the identifiers from
   */
  public async getByFileType (type: SimilarFormatFileTypes): Promise<FilesSearchResponse> {
    let fileExtension = 'json'
    if (type === FileType.Material) fileExtension = 'material'

    const rootKeys = {
      [FileType.Material]: 'materials',
      [FileType.Animation]: 'animations',
      [FileType.AnimationController]: 'animation_controllers',
      [FileType.RenderController]: 'render_controllers',
      [FileType.Particle]: 'particles',
      [FileType.SoundEffect]: 'sound_definition',
    }
    const rootKey = rootKeys[type]

    const files = await this.getFilesFromGlob(`**/${rootKey}/**/*.${fileExtension}`)

    let returnFiles = []
    let returnIdentifiers = []

    for (let file of files) {
      const { node, data, document } = await this.getAndParseFileContents(file)
      if (node && data) {
        const documentJSON: MultiFileType = data

        if (documentJSON[rootKey]) {
          const identifiers = Object.keys(documentJSON[rootKey])

          for (let identifier of identifiers) {
            const path = [ rootKey, identifier ]
            const pointer = findNodeAtLocation(node, path)
            if (pointer) {
              returnFiles.push({
                uri: file,
                name: identifier,
                range: this.nodeToRange(document, pointer)
              })
              returnIdentifiers.push(identifier)
            }
          }
        }
      }
    }

    return {
      files: returnFiles,
      identifiers: returnIdentifiers
    }
  }

  /**
   * Get all entity identifiers from the end specified
   * @param type from which end to attempt to get the entities from
   */
  public async getEntities (type: EntityFileType): Promise<FilesSearchResponse> {
    const entityFileType = type === FileType.ClientEntityIdentifier ? 'minecraft:client_entity' : 'minecraft:entity'
    const folder = type === FileType.ClientEntityIdentifier ? 'entity' : 'entities'

    const entityFiles = await this.getFilesFromGlob(`**/${folder}/**/*.json`)

    let entities = []
    let entityIdentifiers = []

    for (let entityFile of entityFiles) {
      const { node, data, document } = await this.getAndParseFileContents(entityFile)
      if (node && data) {
        const documentJSON: EntityDefinitionFile = data

        if (documentJSON[entityFileType]) {
          if (this.verifyDescriptionIdentifier(documentJSON[entityFileType])) {
            const identifier = this.verifyDescriptionIdentifier(documentJSON[entityFileType])
            if (identifier) {
              const path = [ entityFileType ]
              const pointer = findNodeAtLocation(node, path)
              if (pointer) {
                entities.push({
                  uri: entityFile,
                  name: identifier,
                  range: this.nodeToRange(document, pointer)
                })
                entityIdentifiers.push(identifier)
              }
            }
          }
        }
      }
    }

    return {
      files: entities,
      identifiers: entityIdentifiers
    }
  }

  /**
   * Get all the animations from the document provided
   * @param document the document to get the animations from
   */
  public async getAnimations (document: vscode.TextDocument): Promise<FilesSearchResponse> {
    const { node, data } = await this.getAndParseFileContents(document.uri)

    let animations = []
    let animationIdentifiers = []

    if (node && data) {
      const documentJSON: {
        [key in 'minecraft:client_entity' | 'minecraft:entity']: {
          description: {
            animations: {
              [key: string]: object;
            }
          }
        }
      } = data
  
      const fileRootType = documentJSON['minecraft:client_entity']
        ? 'minecraft:client_entity'
        : documentJSON['minecraft:entity']
          ? 'minecraft:entity'
          : null
  
      if (fileRootType && documentJSON[fileRootType] && documentJSON[fileRootType]['description']) {
        if (documentJSON[fileRootType]['description']['animations']) {
          const animationNames = Object.keys(documentJSON[fileRootType]['description']['animations'])
  
          for (let animationName of animationNames) {
            const path = [ fileRootType, 'description', 'animations', animationName ]
            const pointer = findNodeAtLocation(node, path)
            if (pointer) {
              animations.push({
                uri: document.uri,
                name: animationName,
                range: this.nodeToRange(document, pointer)
              })
              animationIdentifiers.push(animationName)
            }
          }
        }
      }
    }

    return {
      files: animations,
      identifiers: animationIdentifiers
    }
  }

  /**
   * Get a texture from the string specified
   * @param path the path from which to get the texture from
   */
  public async getTexture (path: string): Promise<FileData | undefined> {
    const textures = await vscode.workspace.findFiles(`**/${path}.{png,tga}`)

    if (textures) {
      if (textures[0]) {
        return {
          uri: textures[0],
          name: path,
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
        }
      }
    }
  }

  /**
   * Get the sound definitions
   */
  public async getSoundDefinitions (): Promise<FilesSearchResponse> {
    let getSoundDefinitionFile = await vscode.workspace.findFiles(`**/sounds/sound_definitions.json`)

    let definitions = []
    let definitionIdentifiers = []

    if (getSoundDefinitionFile.length === 1) {
      let soundDefinitionFile = getSoundDefinitionFile[0]
      const { node, data, document } = await this.getAndParseFileContents(soundDefinitionFile)

      if (node && data) {
        const documentJSON = data

        for (let definition of Object.keys(documentJSON)) {
          let path = [ definition ]
          const pointer = findNodeAtLocation(node, path)
          if (pointer) {
            definitions.push({
              uri: soundDefinitionFile,
              name: definition,
              range: this.nodeToRange(document, pointer)
            })
            definitionIdentifiers.push(definition)
          }
        }
      }
    }

    return {
      files: definitions,
      identifiers: definitionIdentifiers
    }
  }
}