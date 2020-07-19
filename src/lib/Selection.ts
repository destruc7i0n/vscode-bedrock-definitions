import * as vscode from 'vscode'

import { getLocation } from 'jsonc-parser'

import { FileType } from '../handlers/FileHandler'

class Selection {
  public path: string[]

  public text: string
  public range: vscode.Range

  private parent: string
  private key: string

  public type: FileType

  constructor (document: vscode.TextDocument, position: vscode.Position) {
    this.path = this.getPathToCursor(document, position)

    const { text, range } = this.getSelectionText(document, position)
    this.text = text
    this.range = range

    // the parent and key of the value in the selection
    const { parent, key } = this.getParentAndKeyFromPath()
    this.parent = parent
    this.key = key

    // the type of the selection
    this.type = this.getSelectionType()
  }

  public setType (type: FileType) {
    this.type = type
  }

  /**
   * Returns a path to the position specified in the text document
   * @param document the text document
   * @param position the position to go to
   */
  public getPathToCursor (document: vscode.TextDocument, position: vscode.Position) {
    let pathKeys: string[] = []

    if (document.fileName.endsWith('.json')) {
      const documentText = document.getText()

      const location = getLocation(documentText, document.offsetAt(position))
      pathKeys = location.path as string[]
    }

    return pathKeys
  }

  /**
   * Returns the parent of the current key, and the current key
   * @param path the path, ending at the current key
   */
  public getParentAndKeyFromPath (): { parent: string, key: string } {
    let parent = this.path[this.path.length - 2]
    if ((parent === undefined || typeof parent === 'number') && this.path.length > 3) parent = this.path[this.path.length - 3]
    const key = this.path[this.path.length - 1]
    return { parent, key }
  }

  /**
   * Returns the current text and word range
   */
  public getSelectionText (document: vscode.TextDocument, position: vscode.Position): { text: string, range: vscode.Range } {
    let range = document.getWordRangeAtPosition(position) as vscode.Range
    let text = document.getText(range)

    // remove quotes
    if (text.startsWith('"') && text.endsWith('"')) {
      range = new vscode.Range(
        range.start.translate(0, 1),
        range.end.translate(0, -1),
      )
      text = document.getText(range).toLowerCase()
    }

    return { text: text, range }
  }

  /**
   * Returns the type of the text specified, based off of the beginning of the text and the parent
   */
  public getSelectionType (): FileType {
    // type, prefix, parent
    const checkGroups: [ FileType, string[] | null, string[] ][] = [
      [FileType.AnimationController, [ 'controller.animation.' ], [ 'animation_controllers', 'animations' ]],
      [FileType.RenderController   , [ 'controller.' ]          , [ 'render_controllers' ]                 ],
      [FileType.Animation          , [ 'animation.' ]           , [ 'animations' ]                         ],
      [FileType.Geometry           , [ 'geometry.' ]            , [ 'geometry' ]                           ],
      [FileType.Particle           , null                       , [ 'particle_effects' ]                   ],
      [FileType.Texture            , null                       , [ 'textures' ]                           ],
      [FileType.Material           , null                       , [ 'materials' ]                          ],
      [FileType.ComponentGroup     , null                       , [ 'component_groups' ]                   ],
      [FileType.Animate            , null                       , [ 'animate' ]                            ],
      [FileType.SoundEffect        , null                       , [ 'sound_effects' ]                      ],
    ]

    let type: FileType = FileType.None

    // infer based on where it is in the file and what is there
    for (let [ groupType, prefixes, parentKeys ] of checkGroups) {
      let usingPrefix = false
      let isChild = false

      if (prefixes) usingPrefix = !!prefixes.find(p => this.text.startsWith(p))
      if (parentKeys && typeof this.parent === 'string') isChild = parentKeys.includes(this.parent)

      if (parentKeys && prefixes) {
        if (isChild && usingPrefix) type = groupType
      } else if (!parentKeys && prefixes) {
        if (usingPrefix) type = groupType
      } else if (parentKeys && !prefixes) {
        if (isChild) type = groupType
      }
    }

    // jump to event definition
    if (this.key === 'event' && type === FileType.None) {
      type = FileType.EventIdentifier
    }

    // jump to entity definition (client or server) if possible
    if (this.key === 'identifier' && this.parent === 'description') {
      if (this.path.includes('minecraft:client_entity')) type = FileType.ClientEntityIdentifier
      else if (this.path.includes('minecraft:entity')) type = FileType.ServerEntityIdentifier
    }

    return type
  }
}

export default Selection
