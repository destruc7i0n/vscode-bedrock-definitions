import { FileType } from '../handlers/FileHandler'

import { ResourceFile } from './types/ResourceFile'

import AnimationFile from './Animation'
import AnimationControllerFile from './AnimationController'
import ClientEntityDefinitionFile from './ClientEntity'
import GeometryFile from './Geometry'
import MaterialFile from './Material'
import ParticleFile from './Particle'
import RenderControllerFile from './RenderController'
import ServerEntityDefinitionFile from './ServerEntity'
import SoundEffectFile from './SoundEffect'
import ServerBlockFile from './ServerBlock'
import DialogueFile from './Dialogue'

export {
  ResourceFile,

  AnimationFile,
  AnimationControllerFile,
  ClientEntityDefinitionFile,
  GeometryFile,
  MaterialFile,
  ParticleFile,
  RenderControllerFile,
  ServerEntityDefinitionFile,
  SoundEffectFile,
  ServerBlockFile,
  DialogueFile,
}

export type Files =
  AnimationControllerFile
  | AnimationFile
  | ClientEntityDefinitionFile
  | GeometryFile
  | MaterialFile
  | ParticleFile
  | RenderControllerFile
  | ServerEntityDefinitionFile
  | SoundEffectFile
  | ServerBlockFile
  | DialogueFile

export type SupportedFileTypes = Files['type']
// export type SupportedFileTypes = Files['type'] & FileType.McFunction
export type FileByType<T extends FileType> = Extract<Files, { type: T }>
