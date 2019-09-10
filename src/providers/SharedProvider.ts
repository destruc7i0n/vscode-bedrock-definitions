import * as vscode from 'vscode'

import { getLocation, Segment } from 'jsonc-parser'

/**
 * The various types of texts
 */
export enum TextType {
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
}

export default class SharedProvider {
  /**
   * Returns a path to the position specified in the text document
   * @param document the text document
   * @param position the position to go to
   */
  public getPathToCursor (document: vscode.TextDocument, position: vscode.Position) {
    const documentText = document.getText()

    const location = getLocation(documentText, document.offsetAt(position))
    const pathKeys = location.path

    return {
      pathKeys
    }
  }

  /**
   * Determines the file type of the JSON file specified
   * @param pathKeys the path
   */
  public getCurrentFileType (pathKeys: Array<any>): { isClientFile: boolean, isBehaviourFile: boolean } {
    // check that in client file, to not perform on the definition itself
    const isClientFile = pathKeys[0] === 'minecraft:client_entity'
    const isBehaviourFile = pathKeys[0] === 'minecraft:entity'

    return {
      isClientFile,
      isBehaviourFile
    }
  }

  /**
   * Returns the parent of the current key, and the current key
   * @param path the path, ending at the current key
   */
  public getParentAndKey (path: Array<Segment>): { parent: Segment, key: Segment } {
    let parent = path[path.length - 2]
    if ((parent === undefined || typeof parent === 'number') && path.length > 3) parent = path[path.length - 3]
    const key = path[path.length - 1]
    return { parent, key }
  }

  /**
   * Returns the current text and word range
   * @param document the text document
   * @param position the position in the document with the text
   */
  public getCurrentText (document: vscode.TextDocument, position: vscode.Position): { currText: string | null, currWordRange: vscode.Range | undefined } {
    let currWordRange = document.getWordRangeAtPosition(position)
    if (currWordRange) {
      let currText = document.getText(currWordRange)

      // remove quotes
      if (currText.startsWith('"') && currText.endsWith('"')) {
        currWordRange = new vscode.Range(
          currWordRange.start.translate(0, 1),
          currWordRange.end.translate(0, -1),
        )
        currText = document.getText(currWordRange).toLowerCase()
      }

      return { currText, currWordRange }
    }
    return { currText: null, currWordRange }
  }

  /**
   * Returns the type of the text specified, based off of the beginning of the text and the parent
   * @param text the text
   * @param parent the parent of the key
   * @param key the current key
   * @param pathKeys the path to the current key
   */
  public getCurrentTextType (text: string, parent: Segment, key: Segment, pathKeys: Array<any>): { type: number, isPointerText: boolean } {
    // type, prefix, parent
    const checkGroups: Array<[ number, Array<string> | null, Array<string> | null ]> = [
      [TextType.AnimationController, [ 'controller.animation.' ], [ 'animation_controllers', 'animations' ]],
      [TextType.RenderController   , [ 'controller.' ]          , [ 'render_controllers' ]                 ],
      [TextType.Animation          , [ 'animation.' ]           , [ 'animations' ]                         ],
      [TextType.Geometry           , [ 'geometry.' ]            , [ 'geometry' ]                           ],
      [TextType.Particle           , null                       , [ 'particle_effects' ]                   ],
      [TextType.Texture            , null                       , [ 'textures' ]                           ],
      [TextType.Material           , null                       , [ 'materials' ]                          ],
      [TextType.ComponentGroup     , null                       , [ 'component_groups' ]                   ],
      [TextType.Animate            , null                       , [ 'animate' ]                            ],
    ]

    let type: number = -1
    let isPointerText: boolean = false

    // infer based on where it is in the file and what is there
    for (let [ groupType, prefixes, parentKeys ] of checkGroups) {
      let usingPrefix: boolean = false
      let isChild: boolean = false

      if (prefixes) usingPrefix = !!prefixes.find(p => text.startsWith(p))
      if (parentKeys && typeof parent === 'string') isChild = parentKeys.includes(parent)

      if (parentKeys && prefixes) {
        if (isChild && usingPrefix) type = groupType
      } else if (!parentKeys && prefixes) {
        if (usingPrefix) type = groupType
      } else if (parentKeys && !prefixes) {
        if (isChild) type = groupType
      }
    }

    // jump to event definition
    if (key === 'event' && type === -1) {
      type = TextType.EventIdentifier
    }

    // jump to entity definition (client or server) if possible
    if (key === 'identifier' && parent === 'description') {
      if (pathKeys.includes('minecraft:client_entity')) type = TextType.ClientEntityIdentifier
      else if (pathKeys.includes('minecraft:entity')) type = TextType.ServerEntityIdentifier
    }

    if (type > -1) isPointerText = true

    return { type, isPointerText }
  }
}
