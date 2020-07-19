import { FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './DescriptionBasedFile'

class ParticleFile extends DescriptionBasedFile {
  type = FileType.Particle
  title = 'Particle'
  root = 'particle_effect'
  glob = `**/particles/**/*.json`
}

export default ParticleFile
