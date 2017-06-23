/**
 * Created by antoine on 08/06/17.
 */

import {Component, OnInit, ViewChild} from '@angular/core';
import * as joint from 'jointjs';
import { Colors } from './colors';
import { Node } from '../../types/Node';
import * as FBPComponent from '../../types/Component';
import * as _ from 'underscore';
import {DataService} from '../../services/data.service';
import {Edge} from '../../types/Edge';
import {SocketService} from '../../services/socket.service';
import { HtmlElementView } from './HtmlElementView';

@Component({
    selector: 'flow',
    templateUrl: './flow.component.html',
})

export class FlowComponent implements OnInit {
    // Attributes
    @ViewChild('jointjs') private jointjs: any;
    private eventHub: any; // Golden layout event hub
    initialized: boolean = false;
    graph: any;
    paper: any;
    components: Map<string, FBPComponent.Component>;
    colors: Colors;
    domElementsNodeMap: Map<any, Node>;
    edgesAwaitingMsgFromServer: Array<Edge> = [];
    linkWaitingForTarget: Map<string, Object> = new Map();
    linkWaitingForSrc: Map<string, Object> = new Map();

    // Constants
    readonly BLOCK_WIDTH: number = 130;
    readonly BLOCK_HEIGHT: number = 40;

    constructor(private appData: DataService, private socket: SocketService) {
        this.colors = new Colors();
        this.components = this.appData.getComponents();
        this.domElementsNodeMap = new Map();
    }

    ngOnInit() {
        // Retrieving width and height for the zone of the graph
        const width = this.jointjs.nativeElement.parentElement.parentElement.parentElement.clientWidth;
        const height = this.jointjs.nativeElement.parentElement.parentElement.parentElement.clientHeight;

        // Initialize the model, named graph and the paper, which is the zone
        // displaying the flows
        this.initialized = true;
        this.graph = this.appData.graph;
        this.paper = new joint.dia.Paper({
            el: this.jointjs.nativeElement,
            width: width,
            height: height,
            model: this.graph,
            gridSize: 1,
            snapLinks: { radius: 15},
            defaultRouter: { name: 'manhattan' },
            defaultConnector: { name: 'rounded' },
        });

        // Configure the html element that will be used as the block elements
        this.createHtmlElement();

        // Initalize event listeners for the graph
        this.addGraphEventsListeners();
    }

    updateNodes () {
        // Add the nodes already retrieved from the server
        const nodes: Array<Node> = this.appData.getNodes();
        if (nodes) {
            nodes.forEach((element) => {
                this.addNode(element);
            });
        }
    }

    updateEdges () {
        // Add the edges already retrieved from the server
        const edges: Array<Edge> = this.appData.getEdges();
        if (edges) {
            edges.forEach((element) => {
                this.addEdge(element);
            });
        }
    }


    /* ----------------------------------------------------------------------------
                            FLOW MANAGEMENT RELATED METHODS
     ---------------------------------------------------------------------------- */

    addNode (node: Node) {
        // Store the node
        if (!this.appData.jointCells.get(node.id)) {
            this.appData.jointCells.set(node.id, node);
            // Create the block that will be added onto the graph
            const block = this.createBlockForNode(node);
            if (block) {
                // Add the block onto the graph
                this.graph.addCell(block);
            }
        }
    }

    removeNode (node: Node) {
        // If the node hasn't already been removed, we remove it.
        // Otherwise, do nothing
        if (this.graph._nodes[node.id]) {
            // Retrieve the cell
            const cell = this.graph.getCell(node.id);
            // Remove it
            if (cell.attributes.type === 'html.Element') {
                this.graph.removeCells(cell);
            }
        }
    }

    removedNode (evt: MouseEvent) {
        // Retrieve the id of the block
        const id = evt.currentTarget['parentElement'].id;

        // Remove it from the graph
        const cell = this.graph.getCell(id);
        this.graph.removeCells(cell);

        // Send a removenode message to the server
        const node = this.appData.getNode(id);
        this.socket.sendRemoveNode(node);

        // Close the window opened for this node
        this.eventHub.emit('closeWindow', node);
    }

    addEdge (edge: Edge) {
        if (!this.appData.jointCells.get(edge.id)) {
            this.appData.jointCells.set(edge.id, edge);
            // Build the link object that is an edge in the jointJs lib
            const link = new joint.dia.Link({
                id: edge.id,
                source: { id: edge.src['node'], port: edge.src['port']},
                target: { id: edge.tgt['node'], port: edge.tgt['port']},
            });

            // Add the edge on the graph
            this.graph.addCell(link);
        } else {
            const i = this.edgesAwaitingMsgFromServer.indexOf(edge);
            this.edgesAwaitingMsgFromServer.splice(i, 1);
        }
    }

    addedEdge (cell: any) {

        const attr = cell.attributes;

        if (attr.target.id) {
            const e: Object = {
                id: attr.id,
                tgt: { node: attr.target.id, port: attr.target.port },
                metadata: {},
                graph: this.appData.flow.id
            };

            this.linkWaitingForSrc.set(e['id'], e);

        } else if (attr.source.id) {
            const e: Object = {
                id: attr.id,
                src: {
                    node: attr.source.id,
                    port: attr.source.port
                },
                metadata: {},
                graph: this.appData.flow.id
            };

            this.linkWaitingForTarget.set(e['id'], e);
        }
    }

    removeEdge(edge: Edge) {
        // If the edge hasn't already been removed, we remove it.
        // Otherwise, do nothing
        if (this.graph._edges[edge.id]) {
            // Retrieve the cell
            const cell = this.graph.getCell(edge.id);
            // Remove it
            if (cell.attributes.type === 'link') {
                this.graph.removeCells(cell);
            }
        }
    }

    removedEdge (cell: any) {
        // Retrieve the edge object
        const edge = this.appData.getEdge(cell.id);
        // Send the message
        this.socket.sendRemoveEdge(edge);
    }

    addEdgeSourceOnWaitingLink (cell: any) {
        if (cell.attributes.source.id !== cell.attributes.target.id
            || cell.attributes.source.port !== cell.attributes.target.port) {
            const e = this.linkWaitingForSrc.get(cell.id);
            this.linkWaitingForSrc.delete(cell.id);
            e['src'] = {
                node: cell.attributes.source.id,
                port: cell.attributes.source.port
            };

            this.createEdge(new Edge(e));

            this.updateSourceConnectedEdge(cell.attributes);
        }
    }

    addEdgeTargetOnWaitingLink (cell: any) {
        if (cell.attributes.source.id !== cell.attributes.target.id
            || cell.attributes.source.port !== cell.attributes.target.port) {
            const e = this.linkWaitingForTarget.get(cell.id);
            this.linkWaitingForTarget.delete(cell.id);
            e['tgt'] = { node: cell.attributes.target.id, port: cell.attributes.target.port };

            this.createEdge(new Edge(e));

            this.updateTargetConnectedEdge(cell.attributes);
        }
    }

    createEdge (e: Edge) {
        // Verify that the edge doesn't already exist
        if ((e.src['node'] !== e.tgt['node'] || e.src['port'] !== e.tgt['port']) && !this.appData.edgeExist(e)) {
            // If doesn't exist, store the info that it will wait for the response from the server
            this.edgesAwaitingMsgFromServer.push(e);
            // Store the edge in the jointCells object
            this.appData.jointCells.set(e.id, e);
            // And send the addedge message to server
            this.socket.sendAddEdge(e);
        }
    }

    edgeChanged (cell: any) {
        // Retrieve the edge object
        const edge = this.appData.getEdge(cell.id);
        edge.src = {
            node: cell.attributes.source.id,
            port: cell.attributes.source.port
        };
        edge.tgt = {
            node: cell.attributes.target.id,
            port: cell.attributes.target.port
        };

        // Send a changeedge message to server
        this.socket.sendChangeEdge(edge);
        this.updateSourceConnectedEdge(cell.attributes);
        this.updateTargetConnectedEdge(cell.attributes);
    }

    updateEdge (oldEdge: Edge, newEdge: Edge) {
        const cell = this.graph.getCell(oldEdge.id);
        const attr = cell.attributes;

        if (attr.source.id === oldEdge.src['node'] && attr.source.port === oldEdge.src['port']
            && attr.target.id === oldEdge.tgt['node'] && attr.target.port === oldEdge.tgt['port'] ) {
            // It means the edge hasn't been changed
            attr.source.id = newEdge.src['node'];
            attr.source.port = newEdge.src['port'];
            attr.target.id = newEdge.tgt['node'];
            attr.target.port = newEdge.tgt['port'];
        }
    }


    /* ----------------------------------------------------------------------------
                                GENERIC METHODS
     ---------------------------------------------------------------------------- */

    createBlockForNode(node: Node) {
        const component = this.appData.getComponents().get(node.component);

        if (component) {
            // Create the block
            const block = new joint.dia.Element({
                id: node.id,
                that: this,
                node: node,
                position: this.nextPosition(),
                size: {
                    width: this.BLOCK_WIDTH,
                    height: this.BLOCK_HEIGHT
                },
                type: 'html.Element',
            });

            if (component.inPorts.length !== 0) {
                block.set('inPorts', component.getInportsAsstringArray());
            }
            if (component.outPorts.length !== 0) {
                block.set('outPorts', component.getOutportsAsstringArray());
            }

            console.log(block);
            return block;

        }
    }

    handleDblClick(cell: any) {
        const id = cell.model.id;
        const node = this.appData.getNode(id);

        if (this.eventHub) {
            this.eventHub.emit('openWindow', node);
        }
    }

    /* ----------------------------------------------------------------------------
                                    SETTERS
     ---------------------------------------------------------------------------- */

    setEventHub(hub: any) {
        this.eventHub = hub;

        // Subscribe to events
        this.eventHub.on('resize', () => {
            this.resize();
        });

        this.eventHub.on('addNode', (node: Node) => {
            this.addNode(node);
        });

        this.eventHub.on('removeNode', (node: Node) => {
            this.removeNode(node);
        });

        this.eventHub.on('addEdge', (edge: Edge) => {
            this.addEdge(edge);
        });

        this.eventHub.on('removeEdge', (edge: Edge) => {
           this.removeEdge(edge);
        });

        this.eventHub.on('Flow and components set up', () => {
            this.updateNodes();
            this.updateEdges();
        });

        this.eventHub.on('updateEdge', (oldEdge: Edge, newEdge: Edge) => {
            this.updateEdge(oldEdge, newEdge);
        });
    }

    /* ----------------------------------------------------------------------------
                                    PRIVATE METHODS
     ---------------------------------------------------------------------------- */

    updateSourceConnectedEdge (attr: any) {
        // Set the connected edge property of the port
        const n = this.appData.getNode(attr.source.id);
        const p = n.getPort(attr.source.port);
        p.addConnectedEdge(attr.id);

        // Send the change node message
        this.socket.sendChangeNode(n);
    }

    updateTargetConnectedEdge (attr: any) {
        // Set the connected edge property of the port
        const n = this.appData.getNode(attr.target.id);
        const p = n.getPort(attr.target.port);
        p.addConnectedEdge(attr.id);

        // Send the change node message
        this.socket.sendChangeNode(n);
    }

    private nextPosition (): Object {
        const occupiedZone = this.occupiedZone();
        const res = { x: 0, y: 0};

        if (occupiedZone['width'] < 0) {
            res.x = 60;
            res.y = 30;
        } else {
            if (occupiedZone['y0'] > (this.BLOCK_HEIGHT + 10)) {
                res.x = 30;
                res.y = 5;
            } else {
                res.x = occupiedZone['x0'];
                res.y = (occupiedZone['y0'] + occupiedZone['height'] + 40);
            }
        }

        return res;

    }

    private occupiedZone (): Object {
        // Create the object that will be returned. It contains the 4 points delimiting the zone containing
        // all the cells
        const points = {
            topLeft: { x: 1000, y: 1000 },
            topRight: { x: 0, y: 1000 },
            bottomLeft: { x: 1000, y: 0 },
            bottomRight: { x: 0, y: 0 }
        };

        // Look at all the cells to determine the occupied zone
        const cells = this.graph.getCells();
        cells.forEach((cell: any) => {
            if (cell.attributes.type === 'html.Element') {
                const position = cell.attributes.position;
                const size = cell.attributes.size;

                if (position.x < points.topLeft.x) { points.topLeft.x = position.x; points.bottomLeft.x = position.x; }
                if (position.y < points.topLeft.y) { points.topLeft.y = position.y; points.topRight.y = position.y; }
                if ((position.x + size.width) > points.topRight.x) {
                    points.topRight.x = (position.x + size.width);
                    points.bottomRight.x = (position.x + size.width);
                }
                if ((position.y + size.height) > points.bottomLeft.y) {
                    points.bottomLeft.y = (position.y + size.height);
                    points.bottomRight.y = (position.y + size.height);
                }
            }
        });

        // Build a much cleaner object to manipulate
        const res = {
            x0 : points.topLeft.x,
            y0 : points.topLeft.y,
            width: (points.topRight.x - points.topLeft.x),
            height: (points.bottomLeft.y - points.topLeft.y)
        };

        return res;
    }

    /* ----------------------------------------------------------------------------
                                  INITIALIZATION METHODS
     ---------------------------------------------------------------------------- */

    addGraphEventsListeners () {
        this.graph.on('add', (cell: any) => {
            if (cell.attributes.type === 'link') {
                this.addedEdge(cell);
            }
        });

        this.graph.on('change:source', (cell: any) => {
            if (cell.attributes.type === 'link' && cell.attributes.source.id && this.linkWaitingForSrc.get(cell.attributes.id)) {
                this.addEdgeSourceOnWaitingLink(cell);
            } else if (cell.attributes.source.id && this.appData.getEdge(cell.id) !== null) {
                this.edgeChanged(cell);
            }
        });

        this.graph.on('change:target', (cell: any) => {
            if (cell.attributes.type === 'link' && cell.attributes.target.id && this.linkWaitingForTarget.get(cell.attributes.id)) {
                this.addEdgeTargetOnWaitingLink(cell);
            } else if (cell.attributes.target.id && this.appData.getEdge(cell.id) !== null) {
                this.edgeChanged(cell);
            }
        });

        this.graph.on('remove', (cell: any) => {
            if (cell.attributes.type === 'link') {
                this.removedEdge(cell);
            } else if (cell.attributes.type === 'devs.Atomic') {
                this.removedNode(cell);
            }
        });

        this.paper.on('cell:pointerdblclick', (a: any) => {
            this.handleDblClick(a);
        });
    }

    createHtmlElement () {
        joint.shapes['html'] = {};
        joint.shapes['html'].Element = new joint.shapes.basic.Generic(_.extend({}, joint.shapes.basic['PortsModelInterface'], {
            markup: '<g class="rotatable"><g class="scalable"><rect/></g><g class="inPorts"/><g class="outPorts"/></g>',
            portMarkup: '<g class="port<%= id %>"><circle/></g>',
            defaults: joint.util.deepSupplement({
                type: 'html.Element',
                attrs: {
                    rect: { stroke: 'none', 'fill-opacity': 0 },
                    circle: {
                        r: 6,
                        magnet: true,
                        stroke: '#555'
                    },
                    '.inPorts circle': { fill: 'white', magnet: 'passive', type: 'input'},
                    '.outPorts circle': { fill: 'white', type: 'output'}
                }
            }, joint.shapes.basic.Rect.prototype['defaults']),
            getPortAttrs (portName: string, index: number, total: number, selector: string, type: string) {

                const attrs = {};
                const portClass = 'port' + index;
                const portSelector = selector + '>.' + portClass;
                const portCircleSelector = portSelector + '>circle';
                attrs[portCircleSelector] = { port: { id: portName || _.uniqueId(type), type: type } };
                attrs[portSelector] = { ref: 'rect', 'ref-y': (index + 0.5) * (1 / total) };
                if (selector === '.outPorts') { attrs[portSelector]['ref-dx'] = 0; }
                return attrs;
            }
        }));

        // Create a custom view for that element that displays an HTML div above it.
        // -------------------------------------------------------------------------

        joint.shapes['html'].ElementView = new HtmlElementView();
    }

    /* ----------------------------------------------------------------------------
                                COMPONENT-SPECIFIC METHODS
     ---------------------------------------------------------------------------- */

    resize() {
        if (this.paper) {
            // Retrieving width and height for the zone of the graph
            const width = this.jointjs.nativeElement.parentElement.parentElement.clientWidth;
            const height = this.jointjs.nativeElement.parentElement.parentElement.clientHeight;

            // Resizing
            this.paper.setDimensions(width, height);
        }
    }


}
