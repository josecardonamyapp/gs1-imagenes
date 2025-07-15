import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../enviroments/environment';

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private baseUrl = environment.api // URL base predeterminada
    // private endpoint = 'vm-salud/api/anual-medical-exams';

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('jwtToken') || '';
        return new HttpHeaders({
            'Authorization': token
        });
    }

    constructor(private http: HttpClient) { }



    getAllProducts(): Observable<any> {
        return this.http.get(environment.api + 'syncfonia-products', {
        });
    }

    productGetByGln(): Observable<any> {
        const headers = new HttpHeaders({ Authorization: 'Bearer 166|hxrkw03cCV5yUg92dZl2BwsoPXljeftAVgjm2xb4' });
        const modules = [
            "trade_item_modules[]=trade_item_description_information", "&",
            "trade_item_modules[]=trade_item_measurements", "&",
            "trade_item_modules[]=referenced_file_detail_information",
        ]
        const trade_item_modules = modules.join('');
        return this.http.get('https://api.syncfonia.com/api/v1/products?page=1&page_size=300&gln=7508006176932&' + trade_item_modules + '', { headers });
    }

    productGetByGtin(gtins: any): Observable<any> {
        console.log('gtin consulta', gtins)
        const headers = new HttpHeaders({ Authorization: 'Bearer 166|hxrkw03cCV5yUg92dZl2BwsoPXljeftAVgjm2xb4' });
        let params = new HttpParams()
            .set('page', '1')
            .set('page_size', '300')
            .set('gln', '7508006176932');
            
        const modules = [
            "trade_item_description_information",
            "trade_item_measurements",
            "referenced_file_detail_information"
        ]
        modules.forEach(module => {
            params = params.append('trade_item_modules[]', module);
        });

        if (Array.isArray(gtins)) {
            for (const gtin of gtins) {
                params = params.append('gtin[]', gtin);
            }
        } else {
            params = params.append('gtin[]', gtins);
        }


        return this.http.get('https://api.syncfonia.com/api/v1/products?', { headers, params });
    }

    productGetChannels() {
        return this.http.get('https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/transformation-channels');
    }

    productProcessImg(params: any) {
        return this.http.post('https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/process-image-with-channel', params);
    }
}