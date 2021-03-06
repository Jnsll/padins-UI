import { AppService } from '../../services/app.service';
import { OnInit, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AppDataService } from '../../services/app-data.service';
import { Http } from '@angular/http';
import {SocketService} from '../../services/socket.service';

@Component ({
    selector: 'workspace-chooser',
    templateUrl: './workspace-chooser.component.html'
})

/**
 * Component for choosing what workspace/project to open and create new ones.
 *
 * It displays all the available workspaces on a grid. Each workspace has its own card. The component takes care
 * of retrieving the list of available workspaces.
 *
 * After selecting the workspace, the app will go to /workspace/:id
 *
 * Created by antoine on 13/07/17.
 */
export class WorkspaceChooserComponent implements OnInit {

    /* -----------------------------------------------------------------------------------------------------------------
                                            ATTRIBUTES
     -----------------------------------------------------------------------------------------------------------------*/

    workspaces: Array<Object>;
    private backgroundColors = ['yellow-bg', 'green-bg', 'orange-bg', 'blue-bg']; // See app/stylesheets/component-colors.scss

    newWorkspace: object = { name: '' };

    showCreateNewWorkspaceModal = false;

    /* -----------------------------------------------------------------------------------------------------------------
                                            CONSTRUCTOR
     -----------------------------------------------------------------------------------------------------------------*/

    constructor (private appService: AppService, private router: Router, private appData: AppDataService,
                 private http: Http, private socket: SocketService) {

    }

    /* -----------------------------------------------------------------------------------------------------------------
                                OnInit INTERFACE METHODS IMPLEMENTATION
     -----------------------------------------------------------------------------------------------------------------*/

    /**
     * On init, set the body's background color to grey, makes sure the workspace connexion socket is closed and
     * download the list of available workspaces.
     */
    ngOnInit () {
        // Set the background of the body to grey
        document.getElementsByTagName('body')[0].classList.remove('white-bg');
        document.getElementsByTagName('body')[0].classList.add('grey-bg');

        // Makes sure the socket used to communicate with a workspace is closed
        this.socket.close();

        // Download the list of workspaces available
        this.fetchWorkspaces();
    }

    /* -----------------------------------------------------------------------------------------------------------------
                                    PUBLIC METHODS FOR THE UI
     -----------------------------------------------------------------------------------------------------------------*/

    /**
     * React to a click on a workspace's card to select it.
     * Set the active workspace in the app's data and redirect to /workspace/:id
     * @param id
     */
    onSelectWorkspace (id: string): void {
        // Set the currentWorkspace of the appData
        this.appData.setWorkspace(id);

        // Display the workspace
        this.router.navigate(['/workspace', id]);
    }

    /**
     * Returns the background color to use for the card that calls this method.
     *
     * @param id {string} the id of the workspace
     * @returns {string} the name of the color to use
     */
    nextBackgroundColor (id: string): string {
        return this.backgroundColors[
            Math.round(parseFloat(id.substring(0, 4).replace(/[a-f-]/g, '')))
            % this.backgroundColors.length
                ] || '';
    }

    /**
     * Send a request to the server to create a new workspace with the information input in the .new-workspace-modal.
     */
    createProject () {
        // Close the modal
        this.showCreateNewWorkspaceModal = false;

        // Add the data into a FormData
        const formData = new FormData();
        formData.append('name', this.newWorkspace['name']);

        // Send the request
        this.http.put(`http${this.appService.serverAddress}/API/workspaces`, formData)
            .toPromise()
            .then(() => { this.fetchWorkspaces(); })
            .catch(() => {
                // If an error occurred we prevent the user
                alert('An error occurred while trying to create a new workspace');
            });
    }

    /* -----------------------------------------------------------------------------------------------------------------
                                            PRIVATE METHODS
     -----------------------------------------------------------------------------------------------------------------*/

    /**
     * Download the list of available workspaces from the server.
     */
    private fetchWorkspaces () {
        const xhr = new XMLHttpRequest();

        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    this.workspaces = JSON.parse(xhr.response);
                    this.appData.storeWorkspacesInfo(this.workspaces);
                }
            }
        };

        xhr.open('GET', 'http' + this.appService.serverAddress + '/API/workspaces', true);
        xhr.send();
    }

}
