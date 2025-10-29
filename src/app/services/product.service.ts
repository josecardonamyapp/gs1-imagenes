import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { Channel } from '../model/channel';

export interface SyncfoniaProduct {
    gtin: string;
    producName: string;
    images: Array<{ uniformresourceidentifier: string; [key: string]: any }>;
    gln?: string;
    brandName?: string;
    functionalName?: string;
    descriptionShort?: string;
    tradeItemDescription?: string;
    image360Path?: string | null;
    attributes: Record<string, string>;
    rawTradeItem?: any;
    partyNameProvider?: string;
}
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
        const hasExcludedRole = roles.some(
            (role: any) =>
                typeof role === 'string' &&
                (excludedRoles.includes(role.toLowerCase()) || role.toLowerCase().includes('retailer'))
        );

        const body: any = {
            Gtin: [],
            IsDataQualityVerified: true,
            Page: 1,
            PageSize: 100,
            TradeItemModules: [
                'ReferencedFileDetailInformation',
                'TradeItemDescriptionInformation'
            ]
        };

        if (!hasExcludedRole && gln) {
            body.Gln = gln;
        }

        return this.http.post('https://api.syncfonia.com/api/v1/products/', body, { headers });
    }

    productGetByGtin(gtins: any, options?: { gln?: string | null }): Observable<any> {
        console.log('GTINS EN SERVICE:', gtins);
        console.log('OPTIONS EN SERVICE:', options);
        const storedGln: string | null = localStorage.getItem('gln');
        const overrideGln = typeof options?.gln === 'string' ? options.gln : null;
        const roles = JSON.parse(localStorage.getItem('roles') || '[]');
        const headers = new HttpHeaders({ Authorization: 'Bearer 166|hxrkw03cCV5yUg92dZl2BwsoPXljeftAVgjm2xb4' });

        const hasExcludedRole = roles.some(
            (role: any) =>
                typeof role === 'string' &&
                (role.toLowerCase() === 'systemadmin' || role.toLowerCase().includes('retailer'))
        );

        const gtinList = Array.isArray(gtins) ? gtins : [gtins];
        const body: any = {
            Gtin: gtinList
                .filter((gtin: any) => gtin !== null && gtin !== undefined && gtin !== '')
                .map((gtin: any) => String(gtin)),
            IsDataQualityVerified: true,
            Page: 1,
            PageSize: 100,
            TradeItemModules: [
                'ReferencedFileDetailInformation',
                'TradeItemDescriptionInformation'
            ]
        };

        const glnToSend = overrideGln && overrideGln.trim() !== '' ? overrideGln : null;
        console.log('GLN TO SEND EN SERVICE:', glnToSend);  

        if (!hasExcludedRole && storedGln) {
            body.Gln = storedGln;
        } else if(hasExcludedRole && glnToSend) {
            body.Gln = glnToSend;
        }
        console.log('hasExcludedRole', hasExcludedRole);

        return this.http.post('https://api.syncfonia.com/api/v1/products/', body, { headers });
    }

    normalizeTradeItemsResponse(response: any): SyncfoniaProduct[] {
        if (!response || typeof response !== 'object') {
            return [];
        }

        const tradeItemList = Array.isArray(response.TradeItemList) ? response.TradeItemList : [];
        return tradeItemList
            .map((tradeItem: any) => this.mapTradeItem(tradeItem))
            .filter((product: SyncfoniaProduct | null): product is SyncfoniaProduct => Boolean(product));
    }

    productGetChannels(gln?: string | number) {
        console.log('GLN recibido en service:', gln);
        const endpoint = 'https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/transformation-channels';
        if (gln === undefined || gln === null) {
            return this.http.get(endpoint);
        }

        const normalizedGln = String(gln).trim();
        if (!normalizedGln) {
            return this.http.get(endpoint);
        }

        return this.http.get(endpoint, {
            params: { gln: normalizedGln }
        });
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

    getProcessingJobsByGln() {
        const storedGln: string | null = localStorage.getItem('gln');
        const endpoint = 'https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/processing-jobs';
        const normalizedGln = (storedGln ?? '').toString().trim();
        return this.http.get(endpoint, {
            params: normalizedGln ? { gln: normalizedGln } : undefined
        });
    }

    getJobStatus(jobId: string): Observable<any> {
        return this.http.get(`https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/job-status/${jobId}`);
    }

    getJobDownloadUrl(jobId: string): Observable<any> {
        return this.http.get(`https://oz0338cueg.execute-api.us-east-1.amazonaws.com/prod/job-zip/${jobId}`);
    }

    private mapTradeItem(tradeItem: any): SyncfoniaProduct | null {
        if (!tradeItem || typeof tradeItem !== 'object') {
            return null;
        }

        const gtin = tradeItem?.GTIN ?? tradeItem?.gtin ?? '';
        const tradeItemInformation = Array.isArray(tradeItem?.TradeItemInformation) ? tradeItem.TradeItemInformation : [];
        const extensions = tradeItemInformation.flatMap((info: any) => {
            const anySection = info?.Extension?.Any;
            if (Array.isArray(anySection)) {
                return anySection;
            }
            return anySection ? [anySection] : [];
        });

        const images = extensions
            .filter((ext: any) => this.isType(ext?.__type, 'ReferencedFileDetailInformation'))
            .flatMap((ext: any) => {
                const headers = ext?.ReferencedFileHeader ?? ext?.referencedfileheader;
                if (Array.isArray(headers)) {
                    return headers;
                }
                return headers ? [headers] : [];
            })
            .map((header: any) => this.normalizeFileHeader(header))
            .filter((header: ({ uniformresourceidentifier: string } & Record<string, any>) | null): header is { uniformresourceidentifier: string } & Record<string, any> => Boolean(header));

        const descriptionEntry = extensions.find((ext: any) => this.isType(ext?.__type, 'TradeItemDescriptionInformation'));
        const descriptionShort = this.extractTextFromSection(descriptionEntry?.DescriptionShort);
        const tradeItemDescription = this.extractTextFromSection(descriptionEntry?.TradeItemDescription);
        const functionalName = this.extractTextFromSection(descriptionEntry?.FunctionalName);
        const brandName = descriptionEntry?.BrandNameInformation?.BrandName ?? '';

        const avpAttributes = this.normalizeAttributes(tradeItem?.AvpList);
        const descriptionFromAvp = avpAttributes['tradeitemdescriptionshortweb'] || avpAttributes['description'] || '';
        const fallbackBrand = avpAttributes['brandname'] || avpAttributes['brand'] || '';

        const attributesFromExtensions = extensions.reduce((acc: Record<string, string>, ext: any) => {
            const normalized = this.normalizeAttributes(ext?.AvpList);
            return { ...acc, ...normalized };
        }, {});

        const mergedAttributes = { ...avpAttributes, ...attributesFromExtensions };
        const image360Path = this.extractAttributeValue(mergedAttributes, 'image360path');

        const informationProvider = tradeItem?.InformationProviderOfTradeItem ?? tradeItem?.informationprovideroftradeitem ?? {};
        const gln = informationProvider?.GLN ?? informationProvider?.gln ?? this.extractAttributeValue(mergedAttributes, 'gln') ?? '';
        const nameProvider = informationProvider?.PartyName ?? informationProvider?.PartyName ?? this.extractAttributeValue(mergedAttributes, 'partyname') ?? '';

        return {
            gtin: gtin ? String(gtin) : '',
            producName: descriptionShort || tradeItemDescription || descriptionFromAvp || '',
            descriptionShort: descriptionShort || '',
            tradeItemDescription: tradeItemDescription || '',
            functionalName: functionalName || '',
            brandName: brandName || fallbackBrand || '',
            gln: typeof gln === 'string' ? gln : '',
            images,
            image360Path: image360Path || null,
            attributes: mergedAttributes,
            rawTradeItem: tradeItem,
            partyNameProvider: typeof nameProvider === 'string' ? nameProvider : ''
        };
    }

    private normalizeFileHeader(header: any): ({ uniformresourceidentifier: string } & Record<string, any>) | null {
        if (!header || typeof header !== 'object') {
            return null;
        }

        const uri = header?.UniformResourceIdentifier ?? header?.uniformresourceidentifier ?? header?.uniformResourceIdentifier;
        if (!uri || typeof uri !== 'string' || uri.trim() === '') {
            return null;
        }

        const normalized: Record<string, any> = { ...header };
        normalized['uniformresourceidentifier'] = uri;

        if (!normalized['filename']) {
            normalized['filename'] = header?.FileName ?? header?.fileName ?? header?.filename ?? '';
        }

        if (!normalized['isprimaryfile']) {
            normalized['isprimaryfile'] = header?.IsPrimaryFile ?? header?.isPrimaryFile ?? header?.isprimaryfile ?? '';
        }

        if (!normalized['referencedfiletypecode']) {
            const typeCode = header?.ReferencedFileTypeCode;
            if (typeof typeCode === 'string') {
                normalized['referencedfiletypecode'] = typeCode;
            } else if (typeCode && typeof typeCode === 'object') {
                normalized['referencedfiletypecode'] = typeCode.Value ?? '';
            }
        }

        return normalized as ({ uniformresourceidentifier: string } & Record<string, any>);
    }

    private extractTextFromSection(section: any): string {
        if (!section) {
            return '';
        }

        if (typeof section === 'string') {
            return section;
        }

        if (typeof section === 'object') {
            if (Array.isArray(section)) {
                for (const item of section) {
                    const value = this.extractTextFromSection(item);
                    if (value) {
                        return value;
                    }
                }
                return '';
            }

            const value = section?.Value ?? section?.value;
            if (typeof value === 'string' && value.trim() !== '') {
                return value;
            }
        }

        return '';
    }

    private normalizeAttributes(avpList: any): Record<string, string> {
        const attributes: Record<string, string> = {};
        if (!avpList || typeof avpList !== 'object') {
            return attributes;
        }

        const stringAvp = Array.isArray(avpList.StringAVP) ? avpList.StringAVP : [];
        stringAvp.forEach((item: any) => {
            const name = item?.AttributeName ?? item?.attributeName;
            const value = item?.AttributeValue ?? item?.attributeValue;
            if (typeof name === 'string' && typeof value === 'string' && name.trim() !== '') {
                attributes[name] = value;
            }
        });

        const compoundAvp = Array.isArray(avpList.CompoundStringAVP) ? avpList.CompoundStringAVP : [];
        compoundAvp.forEach((item: any) => {
            const name = item?.AttributeName ?? item?.attributeName;
            const value = item?.AttributeValue ?? item?.attributeValue;
            if (typeof name === 'string' && typeof value === 'string' && name.trim() !== '') {
                attributes[name] = value;
            }
        });

        return attributes;
    }

    private extractAttributeValue(attributes: Record<string, string>, key: string): string | undefined {
        const normalizedKey = key.toLowerCase();
        for (const attrKey of Object.keys(attributes)) {
            if (attrKey.toLowerCase() === normalizedKey) {
                return attributes[attrKey];
            }
        }
        return undefined;
    }

    private isType(value: any, expected: string): boolean {
        if (typeof value !== 'string') {
            return false;
        }
        return value.toLowerCase().includes(expected.toLowerCase());
    }
}
