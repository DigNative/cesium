/*global defineSuite*/
defineSuite([
        'Scene/TileMapServiceImageryProvider',
        'Core/DefaultProxy',
        'Core/defined',
        'Core/jsonp',
        'Core/loadImage',
        'Core/loadWithXhr',
        'Core/Math',
        'Core/Rectangle',
        'Core/WebMercatorProjection',
        'Core/WebMercatorTilingScheme',
        'Scene/Imagery',
        'Scene/ImageryLayer',
        'Scene/ImageryProvider',
        'Scene/ImageryState',
        'ThirdParty/when'
    ], function(
        TileMapServiceImageryProvider,
        DefaultProxy,
        defined,
        jsonp,
        loadImage,
        loadWithXhr,
        CesiumMath,
        Rectangle,
        WebMercatorProjection,
        WebMercatorTilingScheme,
        Imagery,
        ImageryLayer,
        ImageryProvider,
        ImageryState,
        when) {
    "use strict";
    /*global jasmine,describe,xdescribe,it,xit,expect,beforeEach,afterEach,beforeAll,afterAll,spyOn,runs,waits,waitsFor*/

    afterEach(function() {
        jsonp.loadAndExecuteScript = jsonp.defaultLoadAndExecuteScript;
        loadImage.createImage = loadImage.defaultCreateImage;
        loadWithXhr.load = loadWithXhr.defaultLoad;
    });

    it('conforms to ImageryProvider interface', function() {
        expect(TileMapServiceImageryProvider).toConformToInterface(ImageryProvider);
    });

    it('requires the url to be specified', function() {
        function createWithoutUrl() {
            return new TileMapServiceImageryProvider({});
        }
        expect(createWithoutUrl).toThrowDeveloperError();
    });

    it('returns valid value for hasAlphaChannel', function() {
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server/'
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            expect(typeof provider.hasAlphaChannel).toBe('boolean');
        });
    });

    it('supports a slash at the end of the URL', function() {
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server/'
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            var calledLoadImage = false;
            loadImage.createImage = function(url, crossOrigin, deferred) {
                var doubleSlashIndex = url.indexOf('//');
                expect(doubleSlashIndex).toBeLessThan(0);

                calledLoadImage = true;
                deferred.resolve();
                return undefined;
            };

            provider.requestImage(0, 0, 0);
            expect(calledLoadImage).toEqual(true);
        });
    });

    it('supports no slash at the endof the URL', function() {
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server'
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            var calledLoadImage = false;
            loadImage.createImage = function(url, crossOrigin, deferred) {
                var index = url.indexOf('made/up/tms/server/');
                expect(index).toBeGreaterThan(-1);

                calledLoadImage = true;
                deferred.resolve();
                return undefined;
            };

            provider.requestImage(0, 0, 0);
            expect(calledLoadImage).toEqual(true);
        });
    });

    it('requestImage returns a promise for an image and loads it for cross-origin use', function() {
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server/'
        });

        expect(provider.url).toEqual('made/up/tms/server/');

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        var tile000Image;

        runs(function() {
            expect(provider.tileWidth).toEqual(256);
            expect(provider.tileHeight).toEqual(256);
            expect(provider.maximumLevel).toEqual(18);
            expect(provider.tilingScheme).toBeInstanceOf(WebMercatorTilingScheme);
            expect(provider.rectangle).toEqual(new WebMercatorTilingScheme().rectangle);

            loadImage.createImage = function(url, crossOrigin, deferred) {
                // Just return any old image.
                return loadImage.defaultCreateImage('Data/Images/Red16x16.png', crossOrigin, deferred);
            };

            when(provider.requestImage(0, 0, 0), function(image) {
                tile000Image = image;
            });
        });

        waitsFor(function() {
            return defined(tile000Image);
        }, 'requested tile to be loaded');

        runs(function() {
            expect(tile000Image).toBeInstanceOf(Image);
        });
    });

    it('when no credit is supplied, the provider has no logo', function() {
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server'
        });
        expect(provider.credit).toBeUndefined();
    });

    it('turns the supplied credit into a logo', function() {
        var providerWithCredit = new TileMapServiceImageryProvider({
            url : 'made/up/gms/server',
            credit : 'Thanks to our awesome made up source of this imagery!'
        });
        expect(providerWithCredit.credit).toBeDefined();
    });

    it('routes requests through a proxy if one is specified', function() {
        var proxy = new DefaultProxy('/proxy/');
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server',
            proxy : proxy
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        var tile000Image;

        runs(function() {
            loadImage.createImage = function(url, crossOrigin, deferred) {
                expect(url.indexOf(proxy.getURL('made/up/tms/server'))).toEqual(0);
                expect(provider.proxy).toEqual(proxy);

                // Just return any old image.
                return loadImage.defaultCreateImage('Data/Images/Red16x16.png', crossOrigin, deferred);
            };

            when(provider.requestImage(0, 0, 0), function(image) {
                tile000Image = image;
            });
        });

        waitsFor(function() {
            return defined(tile000Image);
        }, 'requested tile to be loaded');

        runs(function() {
            expect(tile000Image).toBeInstanceOf(Image);
        });
    });

    it('rectangle passed to constructor does not affect tile numbering', function() {
        var rectangle = new Rectangle(0.1, 0.2, 0.3, 0.4);
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server',
            rectangle : rectangle
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            expect(provider.tileWidth).toEqual(256);
            expect(provider.tileHeight).toEqual(256);
            expect(provider.maximumLevel).toEqual(18);
            expect(provider.tilingScheme).toBeInstanceOf(WebMercatorTilingScheme);
            expect(provider.rectangle).toEqual(rectangle);
            expect(provider.tileDiscardPolicy).toBeUndefined();

            var calledLoadImage = false;
            loadImage.createImage = function(url, crossOrigin, deferred) {
                expect(url.indexOf('/0/0/0')).not.toBeLessThan(0);
                calledLoadImage = true;
                deferred.resolve();
                return undefined;
            };

            provider.requestImage(0, 0, 0);
            expect(calledLoadImage).toEqual(true);
        });
    });

    it('uses maximumLevel passed to constructor', function() {
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server',
            maximumLevel : 5
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            expect(provider.maximumLevel).toEqual(5);
        });
    });

    it('raises error event when image cannot be loaded', function() {
        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server'
        });

        var layer = new ImageryLayer(provider);

        var tries = 0;
        provider.errorEvent.addEventListener(function(error) {
            expect(error.timesRetried).toEqual(tries);
            ++tries;
            if (tries < 3) {
                error.retry = true;
            }
        });

        loadImage.createImage = function(url, crossOrigin, deferred) {
            // Succeed after 2 tries
            if (tries === 2) {
                // valid URL
                return loadImage.defaultCreateImage('Data/Images/Red16x16.png', crossOrigin, deferred);
            }

            // invalid URL
            return loadImage.defaultCreateImage(url, crossOrigin, deferred);
        };

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        var imagery;
        runs(function() {
            imagery = new Imagery(layer, 0, 0, 0);
            imagery.addReference();
            layer._requestImagery(imagery);
        });

        waitsFor(function() {
            return imagery.state === ImageryState.RECEIVED;
        }, 'image to load');

        runs(function() {
            expect(imagery.image).toBeInstanceOf(Image);
            expect(tries).toEqual(2);
            imagery.releaseReference();
        });
    });

    it('keeps the rectangle within the bounds allowed by the tiling scheme no matter what the tilemapresource.xml says.', function() {
        loadWithXhr.load = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
            var parser = new DOMParser();
            var xmlString =
                "<TileMap version='1.0.0' tilemapservice='http://tms.osgeo.org/1.0.0'>" +
                "  <Title>dnb_land_ocean_ice.2012.54000x27000_geo.tif</Title>" +
                "  <Abstract/>" +
                "  <SRS>EPSG:900913</SRS>" +
                "  <BoundingBox minx='-88.0' miny='-185.0' maxx='88.0' maxy='185.0'/>" +
                "  <Origin x='-88.0' y='-180.00000000000000'/>" +
                "  <TileFormat width='256' height='256' mime-type='image/png' extension='png'/>" +
                "  <TileSets profile='mercator'>" +
                "    <TileSet href='8' units-per-pixel='611.49622617187504' order='8'/>" +
                "  </TileSets>" +
                "</TileMap>";
            var xml = parser.parseFromString(xmlString, "text/xml");
            deferred.resolve(xml);
        };

        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server'
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            expect(provider.rectangle.west).toEqualEpsilon(CesiumMath.toRadians(-180.0), CesiumMath.EPSILON14);
            expect(provider.rectangle.west).toBeGreaterThanOrEqualTo(provider.tilingScheme.rectangle.west);
            expect(provider.rectangle.east).toEqualEpsilon(CesiumMath.toRadians(180.0), CesiumMath.EPSILON14);
            expect(provider.rectangle.east).toBeLessThanOrEqualTo(provider.tilingScheme.rectangle.east);
            expect(provider.rectangle.south).toEqualEpsilon(-WebMercatorProjection.MaximumLatitude, CesiumMath.EPSILON14);
            expect(provider.rectangle.south).toBeGreaterThanOrEqualTo(provider.tilingScheme.rectangle.south);
            expect(provider.rectangle.north).toEqualEpsilon(WebMercatorProjection.MaximumLatitude, CesiumMath.EPSILON14);
            expect(provider.rectangle.north).toBeLessThanOrEqualTo(provider.tilingScheme.rectangle.north);
        });
    });

    it('uses a minimum level if the tilemapresource.xml specifies one and it is reasonable', function() {
        loadWithXhr.load = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
            var parser = new DOMParser();
            var xmlString =
                "<TileMap version='1.0.0' tilemapservice='http://tms.osgeo.org/1.0.0'>" +
                "  <Title>dnb_land_ocean_ice.2012.54000x27000_geo.tif</Title>" +
                "  <Abstract/>" +
                "  <SRS>EPSG:900913</SRS>" +
                "  <BoundingBox minx='-10.0' miny='5.0' maxx='-9.0' maxy='6.0'/>" +
                "  <Origin x='-88.0' y='-180.00000000000000'/>" +
                "  <TileFormat width='256' height='256' mime-type='image/png' extension='png'/>" +
                "  <TileSets profile='mercator'>" +
                "    <TileSet href='7' units-per-pixel='1222.99245234375008' order='7'/>" +
                "    <TileSet href='8' units-per-pixel='611.49622617187504' order='8'/>" +
                "  </TileSets>" +
                "</TileMap>";
            var xml = parser.parseFromString(xmlString, "text/xml");
            deferred.resolve(xml);
        };

        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server'
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            expect(provider.maximumLevel).toBe(8);
            expect(provider.minimumLevel).toBe(7);
        });
    });

    it('ignores the minimum level in the tilemapresource.xml if it is unreasonable', function() {
        loadWithXhr.load = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
            var parser = new DOMParser();
            var xmlString =
                "<TileMap version='1.0.0' tilemapservice='http://tms.osgeo.org/1.0.0'>" +
                "  <Title>dnb_land_ocean_ice.2012.54000x27000_geo.tif</Title>" +
                "  <Abstract/>" +
                "  <SRS>EPSG:900913</SRS>" +
                "  <BoundingBox minx='-170.0' miny='-85.0' maxx='170.0' maxy='85.0'/>" +
                "  <Origin x='-88.0' y='-180.00000000000000'/>" +
                "  <TileFormat width='256' height='256' mime-type='image/png' extension='png'/>" +
                "  <TileSets profile='mercator'>" +
                "    <TileSet href='7' units-per-pixel='1222.99245234375008' order='7'/>" +
                "    <TileSet href='8' units-per-pixel='611.49622617187504' order='8'/>" +
                "  </TileSets>" +
                "</TileMap>";
            var xml = parser.parseFromString(xmlString, "text/xml");
            deferred.resolve(xml);
        };

        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server'
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            expect(provider.maximumLevel).toBe(8);
            expect(provider.minimumLevel).toBe(0);
        });
    });

    it('Handles XML with casing differences', function() {
        loadWithXhr.load = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
            var parser = new DOMParser();
            var xmlString =
                "<Tilemap version='1.0.0' tilemapservice='http://tms.osgeo.org/1.0.0'>" +
                "  <Title>dnb_land_ocean_ice.2012.54000x27000_geo.tif</Title>" +
                "  <Abstract/>" +
                "  <SRS>EPSG:900913</SRS>" +
                "  <boundingbox minx='-10.0' miny='5.0' maxx='-9.0' maxy='6.0'/>" +
                "  <Origin x='-88.0' y='-180.00000000000000'/>" +
                "  <Tileformat width='256' height='256' mime-type='image/png' extension='png'/>" +
                "  <TileSets profile='mercator'>" +
                "    <tiLeset href='7' units-per-pixel='1222.99245234375008' order='7'/>" +
                "    <tileset href='8' units-per-pixel='611.49622617187504' order='8'/>" +
                "  </TileSets>" +
                "</Tilemap>";
            var xml = parser.parseFromString(xmlString, "text/xml");
            deferred.resolve(xml);
        };

        var provider = new TileMapServiceImageryProvider({
            url : 'made/up/tms/server'
        });

        waitsFor(function() {
            return provider.ready;
        }, 'imagery provider to become ready');

        runs(function() {
            expect(provider.maximumLevel).toBe(8);
            expect(provider.minimumLevel).toBe(7);
        });
    });
});
