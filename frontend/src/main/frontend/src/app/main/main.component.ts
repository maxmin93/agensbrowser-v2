import { Component, OnInit, AfterViewInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { MatSnackBar, MatButtonToggle } from '@angular/material';

import { AgensDataService } from '../services/agens-data.service';

import * as CONFIG from '../app.config';

// Google Analytics
declare let gtag: Function;

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent implements OnInit, AfterViewInit {

  productTitle: string = 'AgensBrowser-web 2.0-beta';

  currentMenu: string = 'main';
  currentPath: string = '/';

  // @ViewChild('btnMenuGroup') public btnMenuGroup: matButtonToggleGroup;
  @ViewChild('btnMenuMain') public btnMenuMain: MatButtonToggle;
  @ViewChild('btnMenuPyeditor') public btnMenuPyeditor: MatButtonToggle;
  @ViewChild('btnMenuGraph') public btnMenuGraph: MatButtonToggle;
  @ViewChild('btnMenuHistory') public btnMenuHistory: MatButtonToggle;

  constructor(
    private _cd: ChangeDetectorRef,
    private _router: Router,
    private _title: Title,
    public _snackBar: MatSnackBar,
    private _api: AgensDataService
  ) {
    this._router.events.subscribe(s => {
      if (s instanceof NavigationEnd) {
        this.currentPath = this._router.url.split('#')[0];
        const tree = _router.parseUrl(this._router.url);
        if (tree.fragment) {
          this.scrollToAnchor(tree.fragment, 100);
        }
      }
    });
  }

  ngOnInit(){
    if( localStorage.getItem(CONFIG.PRODUCT_TITLE_KEY) != null ){
      this.productTitle = localStorage.getItem(CONFIG.PRODUCT_TITLE_KEY);
      gtag('set', {'app_id': this.productTitle});
    }
    if( localStorage.getItem(CONFIG.USER_KEY) != null ){
      let ssid = localStorage.getItem(CONFIG.USER_KEY);
      gtag('set', {'client_id':ssid, 'session_id':ssid});
    }

    // this._api.getCurrentMenu$().subscribe(
    //   x => {
    //     this.currentMenu = x;
    //     // this._cd.detectChanges();
    //   }
    // );
  }

  ngAfterViewInit() {
    this._api.getCurrentMenu$().subscribe(
      x => {
        // ExpressionChangedAfterItHasBeenCheckedError 방지 (ChangeDetectorRef 비추)
        Promise.resolve(null).then(() =>{
          this.currentMenu = x;
          // this._cd.detectChanges();
        });
      }
    );
  }

  /**
   * Scroll to anchor
   *
   * @param {string} location Element id
   * @param {string} wait     Wait time in milliseconds
   */
  public scrollToAnchor(location: string, wait: number): void {
    const element = document.querySelector('#' + location)
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({behavior: 'smooth', block: 'start', inline: 'nearest'})
      }, wait)
    }
  }

  // 작동하지 않음 (이유는 모르겠음. 전에는 되던건데) ==> 제거!!
  toTheTop(){
    this.scrollToAnchor('top', 100);
  }

}
