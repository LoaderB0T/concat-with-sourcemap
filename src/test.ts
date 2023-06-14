import { ConcatWithSourcemap } from './index.js';

(async () => {
  const loader = new ConcatWithSourcemap('my-bundle');
  await loader.addDirectory('./examples/in');

  await loader.saveFiles('./examples/out');
})();
