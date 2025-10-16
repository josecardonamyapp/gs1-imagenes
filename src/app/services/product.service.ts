import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

    constructor(
        private http: HttpClient,
    ) { }



    getAllProducts(): Observable<any> {
        return this.http.get(environment.api + 'syncfonia-products', {
        });
    }

    productGetByGln(): Observable<any> {
        const gln = localStorage.getItem('gln');
        const roles = JSON.parse(localStorage.getItem('roles') || '[]');
        const headers = new HttpHeaders({ Authorization: 'Bearer 166|hxrkw03cCV5yUg92dZl2BwsoPXljeftAVgjm2xb4' });

        const excludedRoles = ['systemadmin'];
        // const hasAllowedRole = roles.some((role: any) => allowedRoles.includes(role));

        const hasExcludedRole = roles.some(
            (role: any) => typeof role === 'string' &&
                (excludedRoles.includes(role.toLowerCase()) || role.toLowerCase().includes('retailer'))
        );

        const modules = [
            ...(!hasExcludedRole ? ["gln=" + gln, "&"] : []),
            "trade_item_modules[]=trade_item_description_information", "&",
            "trade_item_modules[]=trade_item_measurements", "&",
            "trade_item_modules[]=referenced_file_detail_information",
        ]
        const trade_item_modules = modules.join('');
        return this.http.get('https://api.syncfonia.com/api/v1/products?page=1&page_size=300&' + trade_item_modules + '', { headers });
    }

    productGetByGtin(gtins: any): Observable<any> {
        const gln: any = localStorage.getItem('gln');
        const roles = JSON.parse(localStorage.getItem('roles') || '[]');
        const headers = new HttpHeaders({ Authorization: 'Bearer 166|hxrkw03cCV5yUg92dZl2BwsoPXljeftAVgjm2xb4' });

        // const allowedRoles = ['systemadmin'];
        // const hasAllowedRole = roles.some((role: any) => allowedRoles.includes(role));

        const hasExcludedRole = roles.some(
            (role: any) =>
                typeof role === 'string' &&
                (role.toLowerCase() === 'systemadmin' || role.toLowerCase().includes('retailer'))
        );

        let params = new HttpParams()
            .set('page', '1')
            .set('page_size', '300')

        if (!hasExcludedRole) {
            params = params.set('gln', gln);
        }

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

        // const bodyrequest = {
        //     "TradeItemKey":{
        //         "Gln":"7508006476711",
        //         "Gtin":"07506194504070",
        //         "TargetMarketCountryCode":"484"
        //     },
        //     "TradeItemModules":["ALL","TradeItemMeasurements","TradeItemDescriptionInformation"]
        // }


        // return this.http.post('https://api.syncfonia.com/api/v1/products', bodyrequest, { headers });
        return this.http.get('https://api.syncfonia.com/api/v1/products?', { headers, params });
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

    getJobDownloadUrl(jobId: string): Observable<any> {
        return this.http.get(`https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/job-zip/${jobId}`);
    }
}
