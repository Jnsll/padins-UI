/**
 * Created by antoine on 29/06/17.
 */

import {Component} from '@angular/core';
import {DataService} from '../../services/data.service';
import { Node } from '../../types/Node';

@Component ({
    selector: 'data-importer',
    templateUrl: './data-importer.component.html'
})


export class DataImporterComponent {
    // Attributes
    eventHub: any;
    data: Object = {}; // The retrieved and stored data
    linkedNode: Node;

    // Constructor
    constructor (private appData: DataService) {
        // Temporary
        this.data = {
            name: 'antoine',
            age: 21,
            array: [1, 2, 3, 4, 5, 5, 6],
            nestedObject: {
                cat: 'mimi',
                dog: 'jules'
            },
        };
    }

    /* ================================================================================================
                                    UI RELATED METHODS
    ================================================================================================ */

    uploadedFile (e: Event) {
        const files: FileList = e.target['files'];
        console.log(files);

        for (let i = 0; i < files.length; i++) {
            const f: File = files[i];

            switch (f.type) {
                case 'text/plain':
                    this.handleTextPlainFile(f);
                    break;
                case '' :
                    if (f.name.substring(f.name.lastIndexOf('.')) === '.input') {
                        this.handleInputFile(f);
                    } else {
                        this.handleUnknownFile(f);
                    }
                    break;
                case 'application/json':
                    this.handleJsonFile(f);
                    break;
                case 'application/vnd.oasis.opendocument.spreadsheet':
                    this.handleODSFile(f);
                    break;
                case 'application/vnd.ms-excel':
                    this.handleExcelFile(f);
                    break;
                default:
                    break;
            }
        }
    }

    /* ================================================================================================
                                                PARSERS
     ================================================================================================ */

    handleTextPlainFile (f: File) {
        // Try to parse as if it was a Javascript file
    }

    handleUnknownFile (f: File) {

    }

    handleJsonFile (f: File) {
        const reader = new FileReader();
        const res = {};
        Object.assign(res, this.data);

        reader.onload = (e) => {
            // Retrieve the text
            const r = reader.result;
            // Parse it
            const result = JSON.parse(r);
            // Add everything into the this.data object
            for (let key in result) {
               if (result.hasOwnProperty(key)) {
                   res[key] = result[key];
               }
            }

            this.data = res;
        };

        reader.readAsText(f);
    }

    handleODSFile (f: File) {

    }

    handleInputFile (f: File) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Retrieve the text
            const r = reader.result;
            const text = r.split('\n');
            const result = this.indexOfLineWithVar(text);
            const separator = '	'; // It is a kind of tab, not a space
            // Parse it
            let index = result['index'];
            const keys = [];
            const values = [];
            if (index !== -1) {
                const nbOfVar = result['nbOfVar'];

                let s = text[index];
                // Retrieve the keys
                for (let i = 1; i <= nbOfVar; i++) {
                    let key;
                    if (i < nbOfVar ) {
                        key = s.substring(0, s.indexOf(separator));
                    } else {
                        key = s;
                    }

                    keys[i] = key;
                    values[i] = [];
                    s = s.substring(s.indexOf(separator) + separator.length);
                }

                // Retrieve the values
                index++;
                while (index < text.length) {
                    s = text[index];
                    for (let i = 1; i <= nbOfVar; i++) {
                        const value = s.substring(0, s.indexOf(separator));
                        values[i].push(value);
                        s = s.substring(s.indexOf(separator) + separator.length);
                    }
                    index++;
                }

                // Create the final object
                const res = {};
                Object.assign(res, this.data);
                for (let i = 1; i <= nbOfVar; i++) {
                    res[keys[i]] = values[i];
                }

                this.data = res;
            }
        };

        reader.readAsText(f);
    }

    handleExcelFile (f: File) {

    }

    /* ================================================================================================
                SET EVENT METHOD COMMON TO ALL COMPONENT USED BY GL-COMPONENT
     ================================================================================================ */

    setEventHub (eventHub: Event) {
        this.eventHub = eventHub;

        // Subscribing to events
    }

    /* ================================================================================================
                                        UTILS METHODS
     ================================================================================================ */

    indexOfLineWithVar (text: Array<string>): Object {
        let pattern: RegExp;
        let pattern2: RegExp;
        let i = 0;
        let found = false;
        let nbOfVar = 0;
        let lastNbOfVar = 0;
        let indexOfLineWithVar = -1;
        let stop = false;
        let tempRes;
        let lastIndex;
        while (!found && i < text.length) {
            pattern = new RegExp(/(([a-z-A-Z-0-9\-_\[\]()/\.])+(	)*)/g);
            pattern2 = new RegExp(/(-*[0-9]\.[0-9]{6}E[+\-]{0,1}[0-9]{2}){1}(	)*/g);
            nbOfVar = 0;
            stop = false;
            tempRes = pattern2.exec(text[i]) || pattern.exec(text[i]);
            if (tempRes) { nbOfVar++; }
            lastIndex = pattern.lastIndex > pattern2.lastIndex ? pattern.lastIndex : pattern2.lastIndex;
            pattern2.lastIndex = lastIndex; pattern.lastIndex = lastIndex;
            while (lastIndex < text[i].length && (tempRes = pattern2.exec(text[i]) || pattern.exec(text[i])) && !stop) {
                if (lastIndex !== tempRes.index) {
                    stop = true;
                } else {
                    nbOfVar++;
                    lastIndex = pattern.lastIndex > pattern2.lastIndex ? pattern.lastIndex : pattern2.lastIndex;
                    pattern2.lastIndex = lastIndex; pattern.lastIndex = lastIndex;
                }
            }

            if (!stop) {
                if (nbOfVar === lastNbOfVar) {
                    found = true;
                    indexOfLineWithVar = i - 1;
                } else {
                    lastNbOfVar = nbOfVar;
                }
            } else {
                lastNbOfVar = -1;
            }

            i++;
        }

        if (found) {
            return {index: indexOfLineWithVar, nbOfVar: nbOfVar};
        } else {
            return {index: -1, nbOfVar: null};
        }
    }
}