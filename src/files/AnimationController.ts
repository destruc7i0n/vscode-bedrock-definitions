import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class AnimationControllerFile extends KeyBasedFile {
  type = FileType.AnimationController
  root = 'animation_controllers'
  glob = `**/animation_controllers/**/*.json`
}

export default AnimationControllerFile
