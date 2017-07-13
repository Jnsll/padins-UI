import {Component} from '@angular/core';
import {AppService} from './services/app.service';
import {DataService} from './services/data.service';
/**
 * Created by antoine on 19/06/2017.
 */

@Component ({
    selector: 'app',
    templateUrl: './app.component.html'
})

export class AppComponent {

    constructor (private appService: AppService, private appData: DataService) {

    }
}
