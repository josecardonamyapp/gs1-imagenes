import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../enviroments/environment';
import { Channel } from '../model/channel';

export interface SyncfoniaProduct {
    gtin: string;
    producName: string;
    images: Array<{ 
        uniformresourceidentifier: string;
        fileformatname?: string;
        [key: string]: any;
    }>;
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
        const headers = new HttpHeaders({ Authorization: environment.syncfoniaToken });

        const excludedRoles = ['systemadmin'];
        const hasExcludedRole = roles.some(
            (role: any) =>
                typeof role === 'string' &&
                (excludedRoles.includes(role.toLowerCase()) || role.toLowerCase().includes('retailer'))
        );

        const body: any = {
            Gtin: [],
            // IsDataQualityVerified: true,
            Page: 1,
            PageSize: 1000, // Aumentado para obtener más productos del GLN
            TradeItemModules: [
                'ReferencedFileDetailInformation',
                'TradeItemDescriptionInformation'
            ]
        };

        if (!hasExcludedRole && gln) {
            body.Gln = gln;
        }

        return this.http.post(environment.apiSyncfonia + 'products/', body, { headers });
    }

    productGetByGtin(gtins: any, options?: { gln?: string | null }): Observable<any> {
        const storedGln: string | null = localStorage.getItem('gln');
        const overrideGln = typeof options?.gln === 'string' ? options.gln : null;
        const roles = JSON.parse(localStorage.getItem('roles') || '[]');
        const headers = new HttpHeaders({ Authorization: environment.syncfoniaToken });

        const hasExcludedRole = roles.some(
            (role: any) =>
                typeof role === 'string' &&
                (role.toLowerCase() === 'systemadmin' || role.toLowerCase().includes('retailer'))
        );

        const gtinList = Array.isArray(gtins) ? gtins : [gtins];
        const filteredGtinList = gtinList
            .filter((gtin: any) => gtin !== null && gtin !== undefined && gtin !== '')
            .map((gtin: any) => String(gtin));
        
        // Usar la cantidad de GTINs como PageSize, limitado a máximo 250 (límite API)
        const pageSize = Math.min(filteredGtinList.length || 100, 250);
        
        const body: any = {
            Gtin: filteredGtinList,
            // IsDataQualityVerified: true,
            Page: 1,
            PageSize: 350, // Dinámico según cantidad de GTINs (máx 250)
            TradeItemModules: [
                'ReferencedFileDetailInformation',
                'TradeItemDescriptionInformation'
            ]
        };


        const glnToSend = overrideGln && overrideGln.trim() !== '' ? overrideGln : null;

        // Lógica de GLN:
        // - Si NO es admin (hasExcludedRole=false): SIEMPRE usar storedGln del localStorage
        // - Si ES admin (hasExcludedRole=true): 
        //   * Si viene glnToSend en options: usarlo (búsqueda específica de un proveedor)
        //   * Si NO viene glnToSend: NO enviar GLN (búsqueda global de cualquier proveedor)
        if (!hasExcludedRole && storedGln) {
            body.Gln = storedGln;
        } else if (hasExcludedRole && glnToSend) {
            body.Gln = glnToSend;
        } else if (hasExcludedRole && !glnToSend) {
        }

        return this.http.post(environment.apiSyncfonia + 'products/', body, { headers });
    }

    /**
     * Obtiene productos por lista de GTINs con paginación automática
     * Divide la consulta en batches de máximo 250 GTINs y ejecuta requests en paralelo
     * @param gtins - Lista de GTINs a consultar
     * @param options - Opciones adicionales (gln)
     * @returns Observable con la respuesta combinada de todos los batches
     */
    productGetByGtinPaginated(gtins: any, options?: { gln?: string | null }): Observable<any> {
        const BATCH_SIZE = 250; // Límite de API Sincfonia
        
        // Normalizar y filtrar GTINs
        const gtinList = Array.isArray(gtins) ? gtins : [gtins];
        const filteredGtinList = gtinList
            .filter((gtin: any) => gtin !== null && gtin !== undefined && gtin !== '')
            .map((gtin: any) => String(gtin));

        // Si no hay GTINs válidos, retornar respuesta vacía
        if (filteredGtinList.length === 0) {
            console.warn(' No hay GTINs válidos para consultar');
            return of({ TradeItemList: [], TotalCount: 0 });
        }

        // Si caben en un solo batch, usar método normal
        if (filteredGtinList.length <= BATCH_SIZE) {
            return this.productGetByGtin(filteredGtinList, options);
        }

        // Dividir en batches
        const batches = this.splitIntoBatches(filteredGtinList, BATCH_SIZE);

        // Crear requests paralelos para cada batch
        const batchRequests = batches.map((batch, index) => {
            // console.log(` Batch ${index + 1}/${batches.length}: Consultando ${batch.length} GTINs...`);
            
            return this.productGetByGtin(batch, options).pipe(
                map((response: any) => {
                    // La API retorna TradeItemList, no TradeItems
                    const itemCount = response?.TradeItemList?.length || response?.TradeItems?.length || 0;
                    // console.log(` Batch ${index + 1}/${batches.length} completado: ${itemCount} productos recibidos`);
                    // console.log(`    Response keys:`, Object.keys(response || {}));
                    return response;
                }),
                catchError((error) => {
                    // console.error(` Error en batch ${index + 1}/${batches.length}:`, error);
                    // Retornar respuesta vacía para este batch en caso de error
                    return of({ TradeItemList: [], TotalCount: 0 });
                })
            );
        });

        // Ejecutar todos los requests en paralelo y combinar resultados
        return forkJoin(batchRequests).pipe(
            map((responses: any[]) => {
                // console.log(` Combinando ${responses.length} respuestas...`);
                
                // Combinar todos los TradeItems de todas las respuestas
                // Soportar ambos formatos: TradeItemList (API) y TradeItems (ya procesado)
                const allTradeItems = responses.flatMap(response => 
                    response?.TradeItemList || response?.TradeItems || []
                );
                const totalCount = allTradeItems.length;

                // Retornar respuesta consolidada con el formato esperado (usando TradeItemList)
                return {
                    TradeItemList: allTradeItems,  // ← Cambio de TradeItems a TradeItemList
                    TotalCount: totalCount,
                    Page: 1,
                    PageSize: totalCount
                };
            })
        );
    }

    /**
     * Divide un array en batches de tamaño específico
     * @param array - Array a dividir
     * @param batchSize - Tamaño máximo de cada batch
     * @returns Array de batches
     */
    private splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    normalizeTradeItemsResponse(response: any): SyncfoniaProduct[] {
        if (!response || typeof response !== 'object') {
            return [];
        }

        // Soportar ambos formatos: TradeItemList (API normal) y TradeItems (paginación)
        const tradeItemList = Array.isArray(response.TradeItemList) 
            ? response.TradeItemList 
            : (Array.isArray(response.TradeItems) ? response.TradeItems : []);
        
        // Contadores para estadísticas
        let totalImagesBeforeFilter = 0;
        let totalImagesAfterFilter = 0;
        
        let contador = 0;
        const products = tradeItemList
            .map((tradeItem: any) => {
                const product = this.mapTradeItem(tradeItem);
                if (product) {
                    totalImagesAfterFilter += product.images.length;
                }
                return product;
            })
            .filter((product: SyncfoniaProduct | null): product is SyncfoniaProduct => Boolean(product));
        
        // Log de estadísticas de filtrado por FileFormatName
        const filteredCount = totalImagesBeforeFilter - totalImagesAfterFilter;
        if (totalImagesAfterFilter > 0) {
            if (filteredCount > 0) {
                console.log(`    Imágenes filtradas (formato inválido): ${filteredCount}`);
            }
        }
        
        return products;
    }

    productGetChannels(gln?: string | number) {
        const endpoint = environment.api + 'transformation-channels';
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
        return this.http.post(environment.api + 'transformation-channels', channel);
    }

    productUpdateChannel(channelId: number, channel: Channel): Observable<any> {
        return this.http.put(`${environment.api}transformation-channels/${channelId}`, channel);
    }

    productProcessImg(params: any) {
        return this.http.post(environment.api + 'process-multiple-images', params);
    }

    getProcessingJobsByGln() {
        const storedGln: string | null = localStorage.getItem('gln');
        const endpoint = environment.api + 'processing-jobs';
        const normalizedGln = (storedGln ?? '').toString().trim();
        return this.http.get(endpoint, {
            params: normalizedGln ? { gln: normalizedGln } : undefined
        });
    }

    getJobStatus(jobId: string): Observable<any> {
        return this.http.get(`${environment.api}job-status/${jobId}`);
    }

    getJobDownloadUrl(jobId: string): Observable<any> {
        return this.http.get(`${environment.api}job-zip/${jobId}`);
    }

    updateJobName(jobId: string, jobName: string): Observable<any> {
        return this.http.post(environment.api + 'processing-jobs/', {
            job_name: jobName
        }, {
            params: { job_id: jobId }
        });
    }

    private mapTradeItem(tradeItem: any): SyncfoniaProduct | null {
        if (!tradeItem || typeof tradeItem !== 'object') {
            return null;
        }

        const gtin = tradeItem?.GTIN ?? tradeItem?.gtin ?? '';
        // console.log(` mapTradeItem - GTIN: "${gtin}"`);
        
        if (!gtin || gtin.trim() === '') {
            return null;
        }
        
        const tradeItemInformation = Array.isArray(tradeItem?.TradeItemInformation) ? tradeItem.TradeItemInformation : [];
        const extensions = tradeItemInformation.flatMap((info: any) => {
            const anySection = info?.Extension?.Any;
            if (Array.isArray(anySection)) {
                return anySection;
            }
            return anySection ? [anySection] : [];
        });

        // DEBUG: Contar imágenes antes y después del filtro
        const rawImageHeaders = extensions
            .filter((ext: any) => this.isType(ext?.__type, 'ReferencedFileDetailInformation'))
            .flatMap((ext: any) => {
                const headers = ext?.ReferencedFileHeader ?? ext?.referencedfileheader;
                if (Array.isArray(headers)) {
                    return headers;
                }
                return headers ? [headers] : [];
            });
        
        // console.log(` GTIN ${gtin}: ${rawImageHeaders.length} imágenes recibidas de Syncfonia`);
        
        const images = rawImageHeaders
            .map((header: any, index: number) => {
                const result = this.normalizeFileHeader(header);
                const fileFormatName = header?.FileFormatName ?? header?.fileFormatName ?? '';
                
                // console.log(`  [${index + 1}/${rawImageHeaders.length}] FileFormatName: "${fileFormatName}" → ${result ? '✅ INCLUIDA' : '❌ EXCLUIDA'}`);
                
                return result;
            })
            .filter((header: ({ uniformresourceidentifier: string } & Record<string, any>) | null): header is { uniformresourceidentifier: string } & Record<string, any> => Boolean(header))
            .sort((a: any, b: any) => this.compareImagesByFileName(a.filename, b.filename));
        
        // console.log(`  Resultado final: ${images.length} imágenes válidas para GTIN ${gtin}`);

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

        const productResult = {
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
        
        // console.log(` Producto mapeado: GTIN=${productResult.gtin}, Imágenes=${productResult.images.length}, Nombre="${productResult.producName}"`);
        
        return productResult;
    }

    private normalizeFileHeader(header: any): ({ uniformresourceidentifier: string } & Record<string, any>) | null {
        if (!header || typeof header !== 'object') {
            return null;
        }

        const uri = header?.UniformResourceIdentifier ?? header?.uniformresourceidentifier ?? header?.uniformResourceIdentifier;
        if (!uri || typeof uri !== 'string' || uri.trim() === '') {
            return null;
        }

        //  VALIDACIÓN: FileFormatName debe existir y tener un formato válido
        const fileFormatName = header?.FileFormatName ?? header?.fileFormatName ?? '';
        const normalizedFormat = typeof fileFormatName === 'string' ? fileFormatName.toUpperCase().trim() : '';
        
        // Lista blanca de formatos de imagen válidos
        const validFormats = ['JPEG', 'JPG', 'PNG', 'IMAGE/JPEG', 'IMAGE/PNG', 'IMAGE/JPG'];
        
        if (!normalizedFormat || !validFormats.includes(normalizedFormat)) {
            return null; // Excluir imagen sin formato válido
        }

        const normalized: Record<string, any> = { ...header };
        normalized['uniformresourceidentifier'] = uri;
        normalized['fileformatname'] = normalizedFormat; // Guardar formato normalizado

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

    /**
     * Compara dos nombres de archivo para ordenar imágenes por el número después del primer punto.
     * Ejemplo: "00875754004785.1.jpg" → orden 1, "00875754004785.2.jpg" → orden 2
     */
    private compareImagesByFileName(filenameA: string, filenameB: string): number {
        const extractOrderNumber = (filename: string): number => {
            if (!filename || typeof filename !== 'string') {
                return 999999; // Archivos sin nombre van al final
            }

            // Extraer el número después del primer punto
            // Ejemplo: "00875754004785.1.jpg" → "1"
            const match = filename.match(/\.(\d+)\./);
            
            if (match && match[1]) {
                return parseInt(match[1], 10);
            }

            // Si no hay patrón .N., intentar extraer cualquier número
            const numberMatch = filename.match(/(\d+)/);
            if (numberMatch && numberMatch[1]) {
                return parseInt(numberMatch[1], 10);
            }

            return 999999; // Si no hay número, va al final
        };

        const orderA = extractOrderNumber(filenameA);
        const orderB = extractOrderNumber(filenameB);

        return orderA - orderB;
    }
}
