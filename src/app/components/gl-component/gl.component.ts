/**
 * Created by antoine on 07/06/17.
 */

import {
    Component, ComponentFactoryResolver, HostListener, ViewContainerRef,
    ElementRef, ViewChild, NgZone, OnInit
} from '@angular/core';
import { AppComponent } from '../../app.component';
import { App2Component } from '../../app2.component';
import { FlowComponent } from '../flow-component/flow.component';
import { FlowNodesListComponent} from '../flow-nodes-list-component/flow-nodes-list';
declare let GoldenLayout: any;
declare var $: JQueryStatic;

@Component({
    selector: 'golden-layout',
    templateUrl: './template.html',
    entryComponents: [AppComponent, App2Component, FlowComponent, FlowNodesListComponent]
})
export class GLComponent implements OnInit {
    @ViewChild('layout') private layout: any;
    private config: Object;

    constructor(private el: ElementRef, private viewContainer: ViewContainerRef,
                private componentFactoryResolver: ComponentFactoryResolver, private zone: NgZone) {

        this.config = {
            content: [{
                type: 'row',
                content: [{
                    type: 'row',
                    content: [{
                        type: 'component',
                        componentName: 'flow-nodes-list'
                    }, {
                        type: 'component',
                        componentName: 'test1',
                        componentState: {
                            message: 'Middle'
                        }
                    }]
                }, {
                    type: 'column',
                    content: [{
                        type: 'component',
                        componentName: 'test2',
                        componentState: {
                            message: 'Top Right'
                        }
                    }, {
                        type: 'component',
                        componentName: 'flow'
                    }]
                }]
            }]
        };
    }

    ngOnInit() {
        this.layout = new GoldenLayout(this.config, this.layout.nativeElement);

        this.layout.registerComponent('flow', (container: any, componentState: any) => {
            this.zone.run(() => {
                // Creates the component
                let factory = this.componentFactoryResolver.resolveComponentFactory(FlowComponent);

                let compRef = this.viewContainer.createComponent(factory);
                container.getElement().append(compRef.location.nativeElement);

                container['compRef'] = compRef;

                // Trigger a resize event each time the container size change, in order to resize the flow automatically
                container.on( 'resize', function() {
                    window.dispatchEvent(new Event('resize'));
                });
            });
        });

        this.layout.registerComponent('flow-nodes-list', (container: any) => {
            this.zone.run(() => {
                // Creates the component
                let factory = this.componentFactoryResolver.resolveComponentFactory(FlowNodesListComponent);

                let compRef = this.viewContainer.createComponent(factory);
                container.getElement().append(compRef.location.nativeElement);

                container['compRef'] = compRef;
            });
        });

        this.layout.registerComponent('test1', (container: any, componentState: any) => {
            this.zone.run(() => {
                let factory = this.componentFactoryResolver.resolveComponentFactory(AppComponent);

                let compRef = this.viewContainer.createComponent(factory);
                compRef.instance.setEventHub(this.layout.eventHub);
                compRef.instance.message = componentState.message;
                container.getElement().append(compRef.location.nativeElement);

                container['compRef'] = compRef;
            });
        });

        this.layout.registerComponent('test2', (container: any, componentState: any) => {
            this.zone.run(() => {
                let factory = this.componentFactoryResolver.resolveComponentFactory(App2Component);

                let compRef = this.viewContainer.createComponent(factory);
                compRef.instance.setEventHub(this.layout.eventHub);
                compRef.instance.message = componentState.message;
                container.getElement().append(compRef.location.nativeElement);

                container['compRef'] = compRef;
            });
        });

        this.layout.init();

        this.layout.on('itemDestroyed', item => {
            if (item.container != null) {
                let compRef = item.container['compRef'];
                if (compRef != null) {
                    compRef.destroy();
                }
            }
        });
    }

    @HostListener('window:resize', ['$event'])
    onResize(event) {
        if (this.layout) {
            this.layout.updateSize();
        }
    }

    sendEvent() {
        if (this.layout) {
            this.layout.eventHub.emit('someEvent');
        }
    }
}