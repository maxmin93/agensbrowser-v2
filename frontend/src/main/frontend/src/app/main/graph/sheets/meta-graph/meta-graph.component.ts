import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, Inject } from '@angular/core';

import { FormBuilder, FormGroup, FormControl, FormArray } from '@angular/forms';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';

import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle, IProperty, IEnd } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';
import { IGraphDto } from '../../../../models/agens-response-types';

import * as CONFIG from '../../../../app.config';

declare var _: any;
declare var $: any;
declare var agens: any;

@Component({
  selector: 'app-meta-graph',
  templateUrl: './meta-graph.component.html',
  styleUrls: ['./meta-graph.component.scss']
})
export class MetaGraphComponent implements OnInit {

  isVisible: boolean = false;
  metaGraph: IGraph = undefined;

  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;  
  selectedLabel: ILabel = undefined;
  selectedProps: string[] = undefined;

  formGrp: FormGroup;

  groupByList: any[] = [];    // { label: "", props="a,b" }
  filterByList: any[] = [];   // { label: "", prop="a", oper="gt", value="10" };

  filterOpers: string[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'startsWith', 'endsWith'];

  // material elements
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;
  @ViewChild('divPopup', {read: ElementRef}) divPopup: ElementRef;

  constructor(
    private _cd: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private _api: AgensDataService,
    private _util: AgensUtilService,
    private _sheetRef: MatBottomSheetRef<MetaGraphComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any        
  ) {
    this.gid = (this.data) ? _.cloneDeep(this.data['gid']) : -1;
    this.labels = (this.data) ? _.cloneDeep(this.data['labels']) : [];
  }

  ngOnInit() {
    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'single',    // 'single' or 'additive'
        boxSelectionEnabled: false, // if single then false, else true
        useCxtmenu: false,           // whether to use Context menu or not
        hideNodeTitle: false,        // hide nodes' title
        hideEdgeTitle: false,        // hide edges' title
      });
  }

  ngOnDestroy(){

  }

  ngAfterViewInit() {
    this.cy.on('tap', (e) => { 
      if( e.target === this.cy ) this.cyCanvasCallback();
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);

      // change Detection by force
      this._cd.detectChanges();
    });

    this.loadMetaGraph(this.gid);
  }

  close(): void {
    let options:any = this.makeOptions(this.groupByList, this.filterByList);
    this._sheetRef.dismiss( options );
    event.preventDefault();
  }

  /////////////////////////////////////////////////////////////////
  // load meta graph for statistics
  /////////////////////////////////////////////////////////////////

  loadMetaGraph(gid: number){
    if( !gid || gid < 0 ) return;

    // call API
    let data$:Observable<any> = this._api.grph_schema(gid);

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        // console.log(`metaGraph receiving : gid=${x.gid} (${gid})`);
      });
    data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.metaGraph = x;
        this.metaGraph.labels = new Array<ILabel>();
        this.metaGraph.nodes = new Array<INode>();
        this.metaGraph.edges = new Array<IEdge>();    
      });
    data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        // meta-graph 에는 스타일을 부여하지 않는다 (nodes, edges 둘뿐이라)
        this.metaGraph.labels.push( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        // setNeighbors from this.resultGraph.labels;
        x.classes = 'meta';     // meta class style
        x.scratch['_neighbors'] = new Array<string>();
        this.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.props['name'])
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
            x.scratch['_style'] = _.cloneDeep(label.scratch['_style']);
          });
        this.metaGraph.nodes.push( x );
        this.cy.add( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        x.classes = 'meta';     // meta class style
        this.labels
        .filter(val => val.type == 'edges' && val.name == x.data.props['name'])
        .map(label => {
          x.scratch['_style'] = _.cloneDeep(label.scratch['_style']);
        });
        this.metaGraph.edges.push( x );
        this.cy.add( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this._util.calcElementStyles( this.metaGraph.nodes, (x)=>30+x*3, false );
        this._util.calcElementStyles( this.metaGraph.edges, (x)=>2+x, false );
        this.cy.style(agens.graph.stylelist['dark']).update();
        this.changeLayout( this.cy.elements() );
      });

  }

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
    this.selectedElement = undefined;
  }

  findLabel(element:any): ILabel {
    let targets: ILabel[] = this.data['labels'].filter(x => 
        x.id == element._private.data.id && x.type == element._private.group);
    return targets.length > 0 ? targets[0] : undefined;
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    this.selectedElement = target;
    this.selectedLabel = this.findLabel(target);
    this.selectedProps = Object.keys(this.selectedElement.data('props')['propsCount']);
                      // (this.selectedLabel) ? this.selectedLabel.properties : <IProperty[]>[];

    this.makeFormGroup(this.selectedProps, this.selectedElement._private.data.label == 'nodes');
  }  

  // Neighbor Label 로의 확장
  cyQtipMenuCallback( target:any, value:string ){
    // console.log( 'qtipMenuCallback:', target, value );

    // let expandId = target.data('label')+'_'+target.data('id');
    // target.scratch('_expandid', expandId);
    // let position = target.position();
    // let boundingBox = { x1: position.x - 40, x2: position.x + 40, y1: position.y - 40, y2: position.y + 40 };
    // this.runExpandTo( target, targetLabel );
  }

  // 참고 : Angular create checkbox array dynamically
  // https://coryrylan.com/blog/creating-a-dynamic-checkbox-list-in-angular
  makeFormGroup(props:string[], withAll:boolean=false){
    if( withAll ) props.unshift( '$ALL' );
    const controls = props.map(k => new FormControl(false));
    this.formGrp = this.formBuilder.group({
      conditions: new FormArray(controls)
    });
  }

  resetChecked() {
    (<FormArray> this.formGrp.controls.conditions).reset(false);
  }  

  getPropType(key:string): string {
    if( !this.selectedLabel ) return 'unknown';
    if( key == '$ALL' ) return 'for groupBy';
    let info:IProperty[] = this.selectedLabel.properties.filter(x => x.key == key);
    return (info.length > 0) ? info[0].type : "unknown";
  }

  addItemGroupBy() {
    const selected:string[] = this.formGrp.value.conditions
      .map((v, i) => v ? this.selectedProps[i] : null)
      .filter(v => v !== null);

    if( this.selectedLabel )
      selected.forEach(item => {
        let info:IProperty[] = this.selectedLabel.properties.filter(x => x.key == item);
        this.groupByList.push({ label: this.selectedElement.data('props')['name'], prop: item
              , type: (info.length > 0) ? info[0].type : ((item == '$ALL')? "label" : "unknown") });
      });
  }  
  addItemFilterBy() {
    const selected:string[] = this.formGrp.value.conditions
      .map((v, i) => v ? this.selectedProps[i] : null)
      .filter(v => v !== null);

    if( this.selectedLabel )
      selected.forEach(item => {
        if( item == '$ALL' ) return true;
        let info:IProperty[] = this.selectedLabel.properties.filter(x => x.key == item);
        this.filterByList.push({ label: this.selectedElement.data('props')['name'], prop: item
              , oper: "eq", value: ""
              , type: (info.length > 0) ? info[0].type : ((item == '$ALL')? "label" : "unknown") });
      });
  }

  removeItemGroupBy(i:number):any {
    if( this.groupByList.length > i ) return this.groupByList.splice(i,1);
  }
  removeItemFilterBy(i:number):any {
    if( this.filterByList.length > i ) return this.filterByList.splice(i,1);
  }

  makeOptions(gList: any[], fList: any[]):any {
    let options: any = { groups: { }, filters: { } };

    let _translate = function(xs, key, valFn ) {
      return xs.reduce(function(rv, x) {
        let value = valFn(x);
        if( !rv.hasOwnProperty(x[key]) ){
          rv[x[key]] = [ value ];
          return rv;
        } 
        let dupArr = [];  // check duplicate value
        if( Array.isArray(value) ) dupArr = rv[x[key]].filter(y => y[0] == value[0] );
        else dupArr = rv[x[key]].filter(y => y == value )
        if( !dupArr.length ) rv[x[key]].push( value );
        return rv;
      }, {});
    };
    options.groups = _translate( gList, 'label', x => x.prop );
    options.filters = _translate( fList, 'label', 
        x => [x.prop, x.oper, x.type == 'NUMBER' ? Number(x.value):String(x.value), x.type] 
      );

    // groupBy 에 '$ALL'이 있으면 다른 prop 들 무시하고 그것만 남기기
    Object.keys(options.groups).forEach( key => {
      if( options.groups[key].includes('$ALL') ) options.groups[key] = [ '$ALL' ];
    });

    return options;
  }

  /////////////////////////////////////////////////////////////////
  // Graph Controllers
  /////////////////////////////////////////////////////////////////

  // for banana javascript, have to use 'document.querySelector(...)'
  toggleProgressBar(option:boolean = undefined){
    let graphProgressBar:any = document.querySelector('div#progressBarMetaGraph');
    if( !graphProgressBar ) return;

    if( option === undefined ) option = !((graphProgressBar.style.visibility == 'visible') ? true : false);
    // toggle progressBar's visibility
    if( option ) graphProgressBar.style.visibility = 'visible';
    else graphProgressBar.style.visibility = 'hidden';
    this._cd.detectChanges();
  } 

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(){
    // 그래프 비우고
    this.cy.elements().remove();
    // 그래프 라벨 칩리스트 비우고
    this.labels = [];
    this.selectedElement = undefined;
  }

  setGid( gid:number ){ this.gid = gid; }
  addLabel( label:ILabel ){
    this.labels.push( label );
  }
  addNode( ele:INode ){
    this.cy.add( ele );
  }
  addEdge( ele:IEdge ){
    this.cy.add( ele );
  }

  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){
    this.cy.resize();
    this.cy.$api.view.hide( this.cy.elements(`[label='property']`) );
    this.changeLayout( this.cy.elements(`[label!='property']`) );
    agens.cy = this.cy;
  }

  changeLayout( elements ){
    let animation_enabled = localStorage.getItem(CONFIG.ANIMATION_ENABLED_KEY);
    let options = { name: 'cose-bilkent',
      ready: function () {}, stop: function () {},
      nodeDimensionsIncludeLabels: false, refresh: 50, fit: true, padding: 100,
      randomize: true, nodeRepulsion: 4500, idealEdgeLength: 50, edgeElasticity: 0.45,
      nestingFactor: 0.1, gravity: 0.25, numIter: 2500, tile: true,
      animate: animation_enabled == 'true' ? 'end' : false, 
      tilingPaddingVertical: 10, tilingPaddingHorizontal: 10,
      gravityRangeCompound: 1.5, gravityCompound: 1.0, gravityRange: 3.8,
      initialEnergyOnIncremental: 0.5    
    };    

    // adjust layout
    elements.layout(options).run();
  }

  /////////////////////////////////////////////////////////////////
  // Properties Controllers
  /////////////////////////////////////////////////////////////////

  addQtipMenu( elements:any ){
    //
    // **NOTE: cy.on('cxttap', fun..) 구문을 사용하면 안먹는다 (-_-;)
    // 
    // mouse right button click event on nodes
    elements.qtip({
      content: function() { return this.divPopup.nativeElement; },
      style: { classes: 'qtip-bootstrap', tip: { width: 24, height: 8 } },
      position: { target: 'mouse', adjust: { mouse: false } },
      events: { visible: function(event, api) { $('.qtip').click(function(){ $('.qtip').hide(); }); } },
      show: { event: 'cxttap' },          // cxttap: mouse right button click event
      hide: { event: 'click unfocus' }
    });    
  }

  unfoldProperties(){
    this.cy.$api.view.show( this.cy.elements(`[label='property']`) );
    setTimeout(() => {
      this.cy.style(agens.graph.stylelist['dark']).update();
      this.cy.fit( this.cy.elements(), 50);
    }, 100);
  }

  foldProperties(){
    this.cy.$api.view.hide( this.cy.elements(`[label='property']`) );
    this.cy.fit( this.cy.elements(), 50);
  }
}
