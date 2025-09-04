import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from '../../enviroments/environment';

@Injectable({
  providedIn: "root"
})
export class FolderStructureService {
  private baseUrl = environment.api;

  constructor(private http: HttpClient) {}



  getFolderStructureList(): Observable<any> {
    // const headers = new HttpHeaders({ 'Access-Control-Allow-Origin': '*' });
    return this.http.get('https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/folder-structures');
  }
}
