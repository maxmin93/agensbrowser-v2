import { Component, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';

import { Router, NavigationEnd } from '@angular/router';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { MatSnackBar } from '@angular/material';
import { DatatableComponent } from '@swimlane/ngx-datatable';

import * as _ from 'lodash';

import { AgensDataService } from '../../services/agens-data.service';

import { IResponseDto } from '../../models/agens-response-types';
import { ILogs } from '../../models/agens-manager-types';
import * as CONFIG from '../../app.config';
import { concatAll } from 'rxjs/operators';

// Google Analytics
declare let gtag: Function;

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements AfterViewInit {

  private displayedColumns: Array<string> = ['id','userIp','query','state','message','startTime','endTime'];
  // data array
  logRows: ILogs[] = [];
  // filtering 을 위한 임시 array
  tmpRows: ILogs[] = [];

  @ViewChild('logsTable') logsTable: DatatableComponent;

  @ViewChild('progressBar') progressBar: ElementRef;

  constructor(
    private _cd: ChangeDetectorRef,
    private _router: Router,
    private _api: AgensDataService,
  ) { }

  ngAfterViewInit() {
    gtag('set', {'page_title':'history', 'page_path':'/history', 'screen_name':'history'});
    gtag('event', 'screen_view');

    this._api.changeMenu('history');
    this.loadLogs();
  }

  toggleProgress(option:boolean=undefined){
    if( option === undefined ){
      this.progressBar.nativeElement.style.visibility = 
        (this.progressBar.nativeElement.style.visibility == 'visible') ? 'hidden' : 'visible';
    }
    else{
      this.progressBar.nativeElement.style.visibility = option ? 'visible' : 'hidden';
    }
    this._cd.detectChanges();
  }

  /////////////////////////////////////////////////////////////////
  // Data Handlers
  /////////////////////////////////////////////////////////////////

  clear(){
    this.logRows = [];
    this.tmpRows = [];
  }

  reload(){
    this.clear();
    this.loadLogs();
  }

  // call API: manager/logs  
  loadLogs(){

    this.toggleProgress(true);

    this._api.mngr_history().pipe( concatAll() )
    .subscribe(
        data => {
          this.tmpRows.push( <ILogs>data );
        },
        err => {
          this.toggleProgress(false);
          console.log( 'manager.logs: ERROR=', err instanceof HttpErrorResponse, err.error );
          this._api.setResponses(<IResponseDto>{
            group: 'manager.logs',
            state: err.statusText,
            message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
          });
        },
        () => {
          this.toggleProgress(false);
          // cache our list
          this.logRows = [...this.tmpRows];

          // snackBar 메시지 출력
          this._api.setResponses(<IResponseDto>{
            group: 'manager.history',
            state: CONFIG.StateType.SUCCESS,
            message: 'loading logs.size='+this.logRows.length
          });
        });    
  }

  // Table page event
  toggleLogExpandRow(row, col) {
    row._selectedColumn = col;
    this.logsTable.rowDetail.toggleExpandRow(row);
  }

  onRowDetailToggle(event) {
    // console.log('Detail Toggled', event);   // type=row, value={row}
  }

  onActivateTableLabels(event){
    // console.log('onActivateTableLabels: ', event);
  }

  updateFilter(event) {
    const val = event.target.value.toLowerCase();

    // filter our data
    const temp = this.tmpRows.filter(function(d) {
      return d.userIp.toLowerCase().indexOf(val) !== -1 || !val;
    });

    // update the rows
    this.logRows = temp;
  }    
}
