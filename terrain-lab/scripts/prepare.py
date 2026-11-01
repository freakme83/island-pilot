#!/usr/bin/env python3
"""Convert a WGS84 PixelIsPoint GeoTIFF to little-endian Float32 samples."""
import sys, json, math, hashlib
from pathlib import Path
import numpy as np
from PIL import Image
src=Path(sys.argv[1]); out=Path(sys.argv[2]) if len(sys.argv)>2 else Path('terrain-lab/data'); out.mkdir(parents=True,exist_ok=True)
im=Image.open(src); tags=im.tag_v2
if im.mode!='F' or tags.get(34735,())[15:16] != (4326,):
    raise ValueError('Expected a single-band Float32 EPSG:4326 raster')
a=np.asarray(im,dtype='<f4'); nodata=tags.get(42113); invalid=~np.isfinite(a)
if nodata is not None: invalid |= a==float(str(nodata).strip('\x00'))
if invalid.any(): raise ValueError(f'{invalid.sum()} invalid samples: explicit filling policy required')
tie=tags[33922]; scale=tags[33550]; west=tie[3]-tie[0]*scale[0]; north=tie[4]+tie[1]*scale[1]; h,w=a.shape; east=west+(w-1)*scale[0]; south=north-(h-1)*scale[1]
lat=(north+south)/2; lon=(west+east)/2
# WGS84 local tangent approximation at the raster centre.
r=math.radians(lat); e2=6.69437999014e-3; n=6378137/math.sqrt(1-e2*math.sin(r)**2); m=6378137*(1-e2)/(1-e2*math.sin(r)**2)**1.5
sx=n*math.cos(r)*math.pi/180; sz=m*math.pi/180
binary=a.tobytes(order='C'); (out/'heights.f32').write_bytes(binary)
meta=dict(width=w,height=h,west=west,east=east,north=north,south=south,centerLon=lon,centerLat=lat,metersPerDegreeLon=sx,metersPerDegreeLat=sz,widthMeters=(east-west)*sx,depthMeters=(north-south)*sz,minElevation=float(a.min()),maxElevation=float(a.max()),zeroCount=int((a==0).sum()),negativeCount=int((a<0).sum()),invalidCount=int(invalid.sum()),nodata=nodata,sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),encoding='float32 little-endian, row-major north to south',pixelInterpretation='PixelIsPoint; coordinates refer to sample centres')
(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n'); print(json.dumps(meta,indent=2))
