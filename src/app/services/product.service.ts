import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { Channel } from '../model/channel';

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
        return this.http.get('https://api.syncfonia.com/api/v1/products?page=1&page_size=300&gln=7508006176932&'+trade_item_modules+'', { headers });
    }

    productGetByGtin(gtin: any): Observable<any> {
        const headers = new HttpHeaders({ Authorization: 'Bearer 166|hxrkw03cCV5yUg92dZl2BwsoPXljeftAVgjm2xb4' });
        const modules = [
        "trade_item_modules[]=trade_item_description_information", "&",
        "trade_item_modules[]=trade_item_measurements", "&",
        "trade_item_modules[]=referenced_file_detail_information",
        ]
        const trade_item_modules = modules.join('');
        return this.http.get('https://api.syncfonia.com/api/v1/products?page=1&page_size=300&gln=7508006176932&gtin[]='+gtin+'&'+trade_item_modules+'', { headers });
    }

    productGetChannels() {
        return this.http.get('https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/transformation-channels');
    }

    productCreateChannel(channel: Channel): Observable<any> {
        return this.http.post('https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/transformation-channels', channel);
    }

    productUpdateChannel(channelId: number, channel: Channel): Observable<any> {
        return this.http.put(`https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/transformation-channels/${channelId}`, channel);
    }

    productProcessImg(params: any) {
        return this.http.post('https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/process-multiple-images', params);
    }

    getJobStatus(jobId: string): Observable<any> {
        return this.http.get(`https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/job-status/${jobId}`);
    }
}