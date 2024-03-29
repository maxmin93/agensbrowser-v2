import { Injectable } from '@angular/core';
// import { Http, Response } from '@angular/http';
import { HttpClient, HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http';

import { MatSnackBar } from '@angular/material';

import { Observable, Subject, BehaviorSubject, Subscription, empty, of } from 'rxjs';
import { tap, map, filter, concatAll, share } from 'rxjs/operators';
import * as _ from 'lodash';

import { IClientDto, ISchemaDto, IResponseDto, ILabelDto, IResultDto, IPropStatDto, IDoubleListDto } from '../models/agens-response-types';
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty, IRecord, IColumn, IRow } from '../models/agens-data-types';
import { ILogs, IProject } from '../models/agens-manager-types';

import * as CONFIG from '../app.config';

// Google Analytics
declare let gtag: Function;

@Injectable({
  providedIn: 'root'
})
export class AgensDataService {

  private api: any = {
    core: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_CORE_API}`,
    mngr: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_MNGR_API}`,
    auth: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_AUTH_API}`,
    grph: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_GRPH_API}`,
    file: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_FILE_API}`,
    rprt: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_RPRT_API}`,
  };

  private lastResponse$ = new Subject<IResponseDto>();

  private productTitle = 'AgensBrowse-web 2.0-beta';
  // private productTitle$ = new BehaviorSubject<string>('Bitnine');
  private currentMenu$ = new BehaviorSubject<string>("login");

  private client:IClientDto = null;      // ssid, user_name, user_ip, timestamp, valid

  constructor (
    private _http: HttpClient,
    public _snackBar: MatSnackBar
  ) {
    if( CONFIG.DEV_MODE ){
      this.api = {
        core: 'http://127.0.0.1:8085/'+CONFIG.AGENS_CORE_API,
        mngr: 'http://127.0.0.1:8085/'+CONFIG.AGENS_MNGR_API,
        auth: 'http://127.0.0.1:8085/'+CONFIG.AGENS_AUTH_API,
        grph: 'http://127.0.0.1:8085/'+CONFIG.AGENS_GRPH_API,
        file: 'http://127.0.0.1:8085/'+CONFIG.AGENS_FILE_API,
        rprt: 'http://127.0.0.1:8085/'+CONFIG.AGENS_RPRT_API,
      };
      localStorage.setItem(CONFIG.DOWNLOAD_URL, 'http://localhost:8085/api/file/download/');
    }

    this.lastResponse$.subscribe(
      x => this._snackBar.open(x.message, x.state, { duration: 4000, })
    );
  }

  openSnackBar() {
    this.getResponse().subscribe(
      x => this._snackBar.open(x.message, x.state, { duration: 4000, })
    );
  }

  /////////////////////////////////////////////////

  changeMenu(menu: string) {
    this.currentMenu$.next(menu);
  }
  getCurrentMenu$():Observable<string> {
    return this.currentMenu$.asObservable();
  }
  getProductTitle$():Observable<string> {
    // return this.productTitle$.asObservable();
    return of(this.productTitle);
  }

  /////////////////////////////////////////////////

  getSSID():string {
    let ssid = localStorage.getItem(CONFIG.USER_KEY);
    return _.isNil(ssid) ? 'Nil' : ssid;
  }
  getClient():IClientDto {
    return this.client;
  }

  setResponses(dto:IResponseDto) {
    if( dto && dto.hasOwnProperty('state') && dto.hasOwnProperty('message') )
      this.lastResponse$.next(dto);
    // else this.lastResponse$.next();
  }
  getResponse():Observable<IResponseDto> {
    return this.lastResponse$.asObservable();
  }

  /////////////////////////////////////////////////

  // getSchemaSubjects():any {
  //   return this.schema;
  // }
  // getResultSubjects():any {
  //   return this.result;
  // }
  // getTgraphSubjects():any {
  //   return this.tgraph;
  // }

  /////////////////////////////////////////////////

  private createAuthorizationHeader():HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': this.getSSID() });
  }

  auth_valid():Observable<boolean> {
    const url = `${this.api.auth}/valid`;
    return this._http.get<IClientDto>(url, {headers: this.createAuthorizationHeader()})
        .pipe( map(dto => dto.valid), share() );
  }

  auth_connect():Observable<boolean> {
    const url = `${this.api.auth}/connect`;
    // console.log( `[${this.getSSID()}] auth_connect => ${url}`);
    return this._http.get<IClientDto>(url, {headers: new HttpHeaders({'Content-Type': 'application/json'})})
        .pipe( map(dto => {
          this.setResponses(<IResponseDto>dto);
          if( dto.valid === true ){
            this.saveClient(dto);
            return true;
          }
          return false;
        }) );
  }

  private saveClient(dto:IClientDto){
    this.client = dto;
    localStorage.setItem(CONFIG.USER_KEY, dto.ssid);
    gtag('set', {'client_id':dto.ssid, 'session_id':dto.ssid});
    gtag('event', 'new_session', {'event_category':'login', 'ssid': dto.ssid});   // custom_map: dimension1

    // this.productTitle$.next( dto.product_name + ' ' + dto.product_version );
    this.productTitle = dto.product_name + ' ' + dto.product_version;
    localStorage.setItem(CONFIG.PRODUCT_TITLE_KEY, this.productTitle);
    gtag('set', {'app_id': this.productTitle});
    gtag('event', 'product_name', {'event_category':'login', 'event_label':'setting', 'value':dto.product_name});
    gtag('event', 'product_version', {'event_category':'login', 'event_label':'setting', 'value':dto.product_version});

    if( !CONFIG.DEV_MODE && dto.hasOwnProperty('download_url') )
      localStorage.setItem(CONFIG.DOWNLOAD_URL, dto['download_url']);
    if( dto.hasOwnProperty('mode') ){
      localStorage.setItem(CONFIG.CLIENT_MODE_KEY, dto['mode']);
      gtag('event', 'product_mode', {'event_category':'login', 'event_label':'setting', 'value':dto['mode']});
    }
    if( dto.hasOwnProperty('animation_enabled') ){
      localStorage.setItem(CONFIG.ANIMATION_ENABLED_KEY, dto['animation_enabled']+'');
      gtag('event', 'animation_enabled', {'event_category':'login', 'event_label':'setting', 'value':dto['animation_enabled']});
    }
    if( dto.hasOwnProperty('title_shown') ){
      localStorage.setItem(CONFIG.TITLE_SHOWN_KEY, dto['title_shown']+'');
      gtag('event', 'title_shown', {'event_category':'login', 'event_label':'setting', 'value':dto['title_shown']});
    }
  }

  core_schema():Observable<any> {
    const url = `${this.api.core}/schema`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  core_query(gid:number, sql:string):Observable<any> {
    const url = `${this.api.core}/query`;
    // **NOTE: encodeURIComponent( sql ) 처리
    //         (SQL문의 '+','%','&','/' 등의 특수문자 변환)
    let params:HttpParams = new HttpParams().set('sql', encodeURIComponent( sql ) );
    params = params.append('gid', gid+'');

    return this._http.get<any>(url, {params: params, headers: this.createAuthorizationHeader()})
      .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  // call API: expand from selected Node
  core_query_expand( sourceId: string, sourceLabel:string, targetLabel:string ):Observable<any> {
    //
    // ** NOTE: 확장 쿼리
    //     ex) match (s:"customer")-[e]-(v:"order") where id(s) = '11.1' return e, v limit 5;
    // ** NOTE: 확장 노드 사이즈 = 20
    //     20개만 확장 (너무 많아도 곤란) <== 단지 어떤 데이터가 더 있는지 보고 싶은 용도임!
    //
    let sql = `match (s:"${sourceLabel}")-[e]-(v:"${targetLabel}") where to_jsonb(id(s)) = '${sourceId}' return e, v limit 20;`;
    if( this.client.product_version <= '1.2' ){
      sql = `match (s:"${sourceLabel}")-[e]-(v:"${targetLabel}") where id(s) = '${sourceId}' return e, v limit 20;`;
    }

    const url = `${this.api.core}/query`;
    let params:HttpParams = new HttpParams();
    params = params.append('sql', encodeURIComponent( sql ) );
    params = params.append('options', 'loggingOff');

    return this._http.get<any>(url, {params: params, headers: this.createAuthorizationHeader()})
      .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  core_command_drop_label(target:ILabel):Observable<ILabelDto> {
    const url = `${this.api.core}/command`;

    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.DROP);                   // DROP
    if( target.type === 'nodes' ) params = params.append('command', 'vlabel');  // if NODE
    else params = params.append('command', 'elabel');                          // else EDGE
    params = params.append('target', target.name);                             // target
    params = params.append('options', target.desc);                            // label.desc

    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_command_create_label(target:ILabel):Observable<ILabelDto> {
    const url = `${this.api.core}/command`;

    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.CREATE);                 // CREATE
    if( target.type === 'nodes' ) params = params.append('command', 'vlabel');  // if NODE
    else params = params.append('command', 'elabel');                          // else EDGE
    params = params.append('target', target.name);                             // target
    params = params.append('options', target.desc);                            // label.desc

    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_create_label(type:string, name:string):Observable<ILabelDto> {
    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.CREATE);           // CREATE
    if( type === 'nodes' ) params = params.append('command', 'vlabel');  // VLABEL
    else params = params.append('command', 'elabel');                    // or ELABEL
    params = params.append('target', name);                              // <name>

    const url = `${this.api.core}/command`;
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_drop_label(type:string, name:string):Observable<ILabelDto> {
    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.DROP);              // DROP
    if( type === 'nodes' ) params = params.append('command', 'vlabel');   // VLABEL
    else params = params.append('command', 'elabel');                     // or ELABEL
    params = params.append('target', name);                               // <name>

    const url = `${this.api.core}/command`;
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_rename_label(type:string, oldName:string, newName:string):Observable<ILabelDto> {
    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.RENAME);            // ALTER ~ RENAME
    if( type === 'nodes' ) params = params.append('command', 'vlabel');   // VLABEL
    else params = params.append('command', 'elabel');                     // or ELABEL
    params = params.append('target', oldName);                            // <oldName>
    params = params.append('options', newName);                           // <newName>

    const url = `${this.api.core}/command`;
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_comment_label(type:string, name:string, desc:string):Observable<ILabelDto> {
    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.COMMENT);           // COMMENT ON
    if( type === 'nodes' ) params = params.append('command', 'vlabel');   // VLABEL
    else params = params.append('command', 'elabel');                     // or ELABEL
    params = params.append('target', name);                               // <name>
    params = params.append('options', desc);                              // <desc>

    const url = `${this.api.core}/command`;
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  mngr_project_detail(id):Observable<IProject> {
    const url = `${this.api.mngr}/projects/${id}`;
    return this._http.get<IProject>(url, {headers: this.createAuthorizationHeader()});
  }

  mngr_project_image(id):Observable<string> {
    const url = `${this.api.mngr}/projects/${id}/image`;
    let httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'plain/text',
        'Authorization': this.getSSID()
      }),
      'responseType': 'text' as 'json'      // httpclient Requesting non-JSON data
    };
    return this._http.get<string>(url, httpOptions);
  }

  mngr_projects_list():Observable<IProject[]> {
    const url = `${this.api.mngr}/projects`;
    return this._http.get<IProject[]>(url, {headers: this.createAuthorizationHeader()});
  }

  mngr_project_save(project:IProject):Observable<IProject> {
    const url = `${this.api.mngr}/projects/save`;
    return this._http.post<IProject>(url, project, { headers: this.createAuthorizationHeader() });
  }

  mngr_project_delete(id):Observable<IProject> {
    const url = `${this.api.mngr}/projects/delete/${id}`;
    return this._http.get<IProject>(url, {headers: this.createAuthorizationHeader()});
  }

  mngr_history():Observable<ILogs[]> {
    const url = `${this.api.mngr}/logs`;
    return this._http.get<ILogs[]>(url, {headers: this.createAuthorizationHeader()});
  }

  ////////////////////////////////////////////////

  grph_new():Observable<any> {
    const url = `${this.api.grph}/new`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')) );
  }

  grph_graph(gid:number):Observable<any> {
    const url = `${this.api.grph}/${gid}`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  grph_schema(gid:number):Observable<any> {
    const url = `${this.api.grph}/schema/${gid}`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  grph_filterNgroupBy(gid:number, params:any):Observable<any> {
    if( params['filters'].length == 0 && params['groups'].length == 0 ) return empty();

    const url = `${this.api.grph}/filterby-groupby/${gid}`;
    return this._http.post<any>(url, params, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  // update element from query-graph.component or edit-graph.component(created)
  // oper : 'delete' | 'upsert'
  grph_update(gid:number, oper:string, data:any):Observable<any> {
    const url = `${this.api.grph}/update/${gid}/${oper}`;
    return this._http.post<any>(url, data, {headers: this.createAuthorizationHeader()});
  }

  // update properties from edit-graph.component
  // oper : 'delete' | 'upsert'
  grph_update_prop(gid:number, egrp: string, eid:string, oper:string, props:any[]):Observable<any> {
    const url = `${this.api.grph}/update-prop/${gid}/${egrp}/${eid}/${oper}`;
    return this._http.post<any>(url, props, {headers: this.createAuthorizationHeader()});
  }

  grph_save(gid:number, data:IProject):Observable<any> {
    const url = `${this.api.grph}/save/${gid}`;
    return this._http.post<any>(url, data, {headers: this.createAuthorizationHeader()} );
  }

  grph_matching_test(pid:number, ids:string[]):Observable<any> {
    const url = `${this.api.grph}/match/${pid}/test`;
    return this._http.post<any>(url, ids, {headers: this.createAuthorizationHeader()} );
  }

  grph_load(pid:number, onlyData:boolean=false):Observable<any> {
    const url = `${this.api.grph}/load/${pid}`;
    let params:HttpParams = new HttpParams();
    params = params.append('onlyData', onlyData+'');
    return this._http.get<any>(url, { params: params, headers: this.createAuthorizationHeader() })
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  grph_groupBy(gid:number, list:any[]):Observable<any> {
    if( list.length == 0 ) return empty();
    let label:string = list[0]['label'];
    let props:string = list[0]['props'];
    const url = `${this.api.grph}/groupby/${gid}?label=${label}&props=${props}`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  graph_findShortestPath(gid:number, sid:string, eid:string):Observable<IDoubleListDto> {
    const url = `${this.api.grph}/findspath/${gid}`;
    let params:HttpParams = new HttpParams();
    params = params.append('sid', sid);   // start node id
    params = params.append('eid', eid);   // end node id

    return this._http.get<IDoubleListDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  graph_findConnectedGroup(gid:number):Observable<IDoubleListDto> {
    const url = `${this.api.grph}/findcgroup/${gid}`;
    return this._http.get<IDoubleListDto>(url, {headers: this.createAuthorizationHeader()});
  }

  graph_findCycles(gid:number):Observable<IDoubleListDto> {
    const url = `${this.api.grph}/findcycles/${gid}`;
    return this._http.get<IDoubleListDto>(url, {headers: this.createAuthorizationHeader()});
  }

  grph_propStat(gid:number, group:string, label:string, prop:string):Observable<IPropStatDto> {
    const url = `${this.api.grph}/propstat/${gid}`;
    let params:HttpParams = new HttpParams();
    params = params.append('group', group);   // nodes, edges
    params = params.append('label', label);
    params = params.append('prop', prop);
    return this._http.get<IPropStatDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  //////////////////////////////////////////////////////

  core_pglang_list():Observable<any> {
    const url = `${this.api.core}/pglang/list`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()});
  }

  core_pgproc_list():Observable<any> {
    const url = `${this.api.core}/pgproc/list`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()});
  }

  core_pgproc_detail(pid:string):Observable<any> {
    const url = `${this.api.core}/pgproc/${pid}`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()});
  }

  core_pgproc_save(proc:any):Observable<IResponseDto> {
    const url = `${this.api.core}/pgproc/save`;
    return this._http.post<any>(url, proc, {headers: this.createAuthorizationHeader()});
  }

  core_pgproc_delete(proc:any):Observable<IResponseDto> {
    const url = `${this.api.core}/pgproc/delete`;
    return this._http.post<any>(url, proc, {headers: this.createAuthorizationHeader()});
  }

  //////////////////////////////////////////////////////
  // **참고
  // https://www.codingforentrepreneurs.com/blog/file-upload-with-angular/
  // https://malcoded.com/posts/angular-file-upload-component-with-express

  // graphson type: json, "application/json"
  // graphml type: xml, "text/xml"
  // gryo type: kryo, ""                      <== kryo는 내부에서만 쓰고 json, xml 만 사용

  fileUpload(fileItem:File, extraData?:object):any{
    const url = `${this.api.file}/upload`;
    const formData: FormData = new FormData();

    formData.append('file', fileItem, fileItem.name);
    if (extraData) {
      for(let key in extraData){
        // iterate and set other form data
        formData.append(key, extraData[key])
      }
    }

    const req = new HttpRequest('POST', url, formData, {
      // **NOTE: 이거 필요 없음! 오류만 발생함 ==> 'Content-Type': 'multipart/form-data'
      headers: new HttpHeaders({ 'Authorization': this.getSSID() }),
      reportProgress: true // for progress data
    });
    return this._http.request(req);
  }

  fileDownload(url): Observable<any>{
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()});
  }

  importFile(gid: number, fileItem:File, extraData?:object):any{
    const url = `${this.api.file}/import`;
    const formData: FormData = new FormData();

    formData.append('gid', gid+'');    // convert number to string
    formData.append('file', fileItem, fileItem.name);
    if (extraData) {
      for(let key in extraData){
        // iterate and set other form data
        formData.append(key, extraData[key])
      }
    }

    const req = new HttpRequest('POST', url, formData, {
      // **NOTE: 이거 필요 없음! 오류만 발생함 ==> 'Content-Type': 'multipart/form-data'
      headers: new HttpHeaders({
        // 'Content-Type': 'application/octet-stream; charset=utf-8',
        'Authorization': this.getSSID()
      }),
      reportProgress: true // for progress data
    });
    return this._http.request(req);
  }

  // exportFile(gid: number, fileType:string):any{
  //   const url = `${this.api.file}/export`;

  //   let params:HttpParams = new HttpParams();
  //   params = params.append('gid', gid+'');
  //   params = params.append('type', fileType);   // graphson or graphml

  //   let httpOptions = {
  //     headers: new HttpHeaders({
  //       'Content-Type': 'application/octet-stream; charset=utf-8',
  //       'Authorization': this.getSSID()
  //     }),
  //     params: params,
  //     'responseType': 'text' as 'json'      // httpclient Requesting non-JSON data
  //   };
  //   return this._http.get<string>(url, httpOptions);
  // }

  exportFile(fileType:string, data:any):any{
    const url = `${this.api.file}/export/${fileType}`;
    let httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': this.getSSID()
      }),
      'responseType': 'text' as 'json'      // httpclient Requesting non-JSON data
    };
    return this._http.post<string>(url, data, httpOptions);
  }

  //////////////////////////////////////////////////////

  report_graph(pid:number, guestKey:string):Observable<any> {
    const url = `${this.api.rprt}/graph/${pid}`;
    // let params:HttpParams = new HttpParams();
    // params = params.append('guestKey', guestKey);
    let headers = new HttpHeaders({'Content-Type': 'application/json', 'Authorization': guestKey })
    return this._http.get<any>(url, { headers: headers })
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

}
