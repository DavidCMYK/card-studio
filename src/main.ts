// Entry point. Importing the editor registers the UI event listeners.
import './editor';

import './mobile-interface';

import {initRecovery} from './recovery';
import {resetFileHandles} from './project-storage';
initRecovery(resetFileHandles);
