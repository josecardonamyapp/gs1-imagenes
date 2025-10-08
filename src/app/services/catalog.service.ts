import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { Catalog, CreateCatalogApiPayload, CreateCatalogPayload } from '../model/catalog';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private readonly baseUrl = environment.api;

  constructor(private http: HttpClient) {}

  createCatalog(payload: CreateCatalogPayload): Observable<Catalog> {
    return this.http.post<Catalog>(`${this.baseUrl}product-catalogs`, payload, {
      headers: this.buildHeaders()
    });
  }

  createCatalogWithProducts(payload: CreateCatalogApiPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}catalogs`, payload, {
      headers: this.buildHeaders()
    });
  }

  getCatalogs(): Observable<Catalog[]> {
    return this.http.get<Catalog[]>(`${this.baseUrl}product-catalogs`, {
      headers: this.buildHeaders()
    });
  }

  private buildHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwtToken') || '';
    const headersConfig: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headersConfig['Authorization'] = token;
    }

    return new HttpHeaders(headersConfig);
  }
}

