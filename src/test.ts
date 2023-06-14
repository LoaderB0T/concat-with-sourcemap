import { writeFileSync } from 'fs';
import { ConcatWithSourcemap } from './index.js';

const loader = new ConcatWithSourcemap('my-bundle');
const res = await loader.addDirectory('./examples/in');

await loader.saveFiles('./examples/out');
