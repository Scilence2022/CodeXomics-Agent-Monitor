import {writeFile} from 'node:fs/promises';
import {observedSnapshot} from './adapter.mjs';
const snapshot=await observedSnapshot({workspace:process.env.ANNOTATION_WORKSPACE||process.argv[2],dgrTaskFile:process.env.DGR_TASK_FILE||process.argv[3]});await writeFile(process.argv[4]||'.data/exported-snapshot.json',JSON.stringify(snapshot));console.log('Observed snapshot exported');
