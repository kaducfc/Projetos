// GERADO por ferramentas/gerar_terreno.py a partir de mapa-fonte.json. Coordenadas normalizadas: x e y de 0 a 1 sobre a imagem.
export const MAPA = {
 "imagem": {
  "arquivo": "img/mapa-sr.webp",
  "largura": 1487,
  "altura": 1058
 },
 "mundo": {
  "unidadesPorPixel": 10,
  "largura": 14870,
  "altura": 10580
 },
 "bases": {
  "azul": {
   "nexus": [
    0.10087,
    0.92628
   ],
   "fonte": [
    0.13114,
    0.88847
   ],
   "poligono": [
    [
     0.0928,
     0.65595
    ],
    [
     0.18561,
     0.6465
    ],
    [
     0.20175,
     0.65974
    ],
    [
     0.26765,
     0.67297
    ],
    [
     0.29926,
     0.6862
    ],
    [
     0.31742,
     0.69943
    ],
    [
     0.35104,
     0.75236
    ],
    [
     0.36651,
     0.79395
    ],
    [
     0.37391,
     0.85066
    ],
    [
     0.3766,
     0.93573
    ],
    [
     0.36315,
     0.94896
    ],
    [
     0.10087,
     0.94896
    ],
    [
     0.06725,
     0.93195
    ],
    [
     0.05918,
     0.88847
    ],
    [
     0.07532,
     0.7845
    ],
    [
     0.08406,
     0.71834
    ]
   ]
  },
  "vermelho": {
   "nexus": [
    0.85071,
    0.09924
   ],
   "fonte": [
    0.82381,
    0.14178
   ],
   "poligono": [
    [
     0.62542,
     0.10586
    ],
    [
     0.67249,
     0.10208
    ],
    [
     0.73974,
     0.09452
    ],
    [
     0.80699,
     0.08318
    ],
    [
     0.86752,
     0.06805
    ],
    [
     0.89106,
     0.07561
    ],
    [
     0.89442,
     0.15123
    ],
    [
     0.89307,
     0.24575
    ],
    [
     0.89106,
     0.34026
    ],
    [
     0.88904,
     0.37996
    ],
    [
     0.86752,
     0.38752
    ],
    [
     0.84398,
     0.37429
    ],
    [
     0.79354,
     0.35161
    ],
    [
     0.75319,
     0.34026
    ],
    [
     0.69401,
     0.32892
    ],
    [
     0.66241,
     0.27221
    ],
    [
     0.6503,
     0.23819
    ],
    [
     0.64223,
     0.20983
    ],
    [
     0.63551,
     0.16824
    ],
    [
     0.62677,
     0.13043
    ]
   ]
  }
 },
 "rotas": {
  "topo": {
   "nome": "Topo",
   "largura": 0.05111,
   "pts": [
    [
     0.15871,
     0.71834
    ],
    [
     0.1614,
     0.65217
    ],
    [
     0.16476,
     0.56711
    ],
    [
     0.16947,
     0.49149
    ],
    [
     0.17081,
     0.40643
    ],
    [
     0.16947,
     0.32136
    ],
    [
     0.1735,
     0.24575
    ],
    [
     0.19166,
     0.18904
    ],
    [
     0.22865,
     0.15595
    ],
    [
     0.28245,
     0.14178
    ],
    [
     0.3497,
     0.13989
    ],
    [
     0.4304,
     0.138
    ],
    [
     0.5111,
     0.13422
    ],
    [
     0.57835,
     0.13233
    ],
    [
     0.62206,
     0.13233
    ],
    [
     0.66241,
     0.14178
    ]
   ],
   "comprimentoPx": 1279
  },
  "meio": {
   "nome": "Meio",
   "largura": 0.05111,
   "pts": [
    [
     0.28917,
     0.77032
    ],
    [
     0.32616,
     0.72306
    ],
    [
     0.3766,
     0.67297
    ],
    [
     0.4304,
     0.61437
    ],
    [
     0.48823,
     0.55293
    ],
    [
     0.538,
     0.49338
    ],
    [
     0.58574,
     0.44045
    ],
    [
     0.63215,
     0.38752
    ],
    [
     0.67249,
     0.34499
    ],
    [
     0.69939,
     0.31191
    ],
    [
     0.72629,
     0.28355
    ]
   ],
   "comprimentoPx": 830
  },
  "baixo": {
   "nome": "Baixo",
   "largura": 0.05111,
   "pts": [
    [
     0.36315,
     0.90737
    ],
    [
     0.4035,
     0.92817
    ],
    [
     0.47075,
     0.93384
    ],
    [
     0.538,
     0.93573
    ],
    [
     0.60525,
     0.93573
    ],
    [
     0.67249,
     0.93195
    ],
    [
     0.73974,
     0.92439
    ],
    [
     0.79354,
     0.90926
    ],
    [
     0.83389,
     0.87902
    ],
    [
     0.85945,
     0.83176
    ],
    [
     0.87088,
     0.75614
    ],
    [
     0.8729,
     0.66163
    ],
    [
     0.8729,
     0.56711
    ],
    [
     0.87155,
     0.47259
    ],
    [
     0.86886,
     0.40643
    ],
    [
     0.86752,
     0.35444
    ]
   ],
   "comprimentoPx": 1284
  }
 },
 "estruturas": [
  {
   "id": "torre_topo_3_azul",
   "tipo": "torre",
   "nivel": 3,
   "rota": "topo",
   "equipe": "azul",
   "pos": [
    0.16326,
    0.6051
   ]
  },
  {
   "id": "torre_topo_3_vermelho",
   "tipo": "torre",
   "nivel": 3,
   "rota": "topo",
   "equipe": "vermelho",
   "pos": [
    0.58226,
    0.13233
   ]
  },
  {
   "id": "torre_topo_2_azul",
   "tipo": "torre",
   "nivel": 2,
   "rota": "topo",
   "equipe": "azul",
   "pos": [
    0.16961,
    0.48257
   ]
  },
  {
   "id": "torre_topo_2_vermelho",
   "tipo": "torre",
   "nivel": 2,
   "rota": "topo",
   "equipe": "vermelho",
   "pos": [
    0.49486,
    0.13498
   ]
  },
  {
   "id": "torre_topo_1_azul",
   "tipo": "torre",
   "nivel": 1,
   "rota": "topo",
   "equipe": "azul",
   "pos": [
    0.16948,
    0.32193
   ]
  },
  {
   "id": "torre_topo_1_vermelho",
   "tipo": "torre",
   "nivel": 1,
   "rota": "topo",
   "equipe": "vermelho",
   "pos": [
    0.38058,
    0.13916
   ]
  },
  {
   "id": "inibidor_topo_azul",
   "tipo": "inibidor",
   "rota": "topo",
   "equipe": "azul",
   "pos": [
    0.15902,
    0.71079
   ]
  },
  {
   "id": "inibidor_topo_vermelho",
   "tipo": "inibidor",
   "rota": "topo",
   "equipe": "vermelho",
   "pos": [
    0.6571,
    0.14053
   ]
  },
  {
   "id": "torre_meio_3_azul",
   "tipo": "torre",
   "nivel": 3,
   "rota": "meio",
   "equipe": "azul",
   "pos": [
    0.34026,
    0.70906
   ]
  },
  {
   "id": "torre_meio_3_vermelho",
   "tipo": "torre",
   "nivel": 3,
   "rota": "meio",
   "equipe": "vermelho",
   "pos": [
    0.67409,
    0.34303
   ]
  },
  {
   "id": "torre_meio_2_azul",
   "tipo": "torre",
   "nivel": 2,
   "rota": "meio",
   "equipe": "azul",
   "pos": [
    0.38129,
    0.66785
   ]
  },
  {
   "id": "torre_meio_2_vermelho",
   "tipo": "torre",
   "nivel": 2,
   "rota": "meio",
   "equipe": "vermelho",
   "pos": [
    0.63384,
    0.38574
   ]
  },
  {
   "id": "torre_meio_1_azul",
   "tipo": "torre",
   "nivel": 1,
   "rota": "meio",
   "equipe": "azul",
   "pos": [
    0.4318,
    0.61287
   ]
  },
  {
   "id": "torre_meio_1_vermelho",
   "tipo": "torre",
   "nivel": 1,
   "rota": "meio",
   "equipe": "vermelho",
   "pos": [
    0.58417,
    0.4422
   ]
  },
  {
   "id": "inibidor_meio_azul",
   "tipo": "inibidor",
   "rota": "meio",
   "equipe": "azul",
   "pos": [
    0.29514,
    0.76269
   ]
  },
  {
   "id": "inibidor_meio_vermelho",
   "tipo": "inibidor",
   "rota": "meio",
   "equipe": "vermelho",
   "pos": [
    0.71984,
    0.29036
   ]
  },
  {
   "id": "torre_baixo_3_azul",
   "tipo": "torre",
   "nivel": 3,
   "rota": "baixo",
   "equipe": "azul",
   "pos": [
    0.44115,
    0.93134
   ]
  },
  {
   "id": "torre_baixo_3_vermelho",
   "tipo": "torre",
   "nivel": 3,
   "rota": "baixo",
   "equipe": "vermelho",
   "pos": [
    0.87136,
    0.46773
   ]
  },
  {
   "id": "torre_baixo_2_azul",
   "tipo": "torre",
   "nivel": 2,
   "rota": "baixo",
   "equipe": "azul",
   "pos": [
    0.52851,
    0.93546
   ]
  },
  {
   "id": "torre_baixo_2_vermelho",
   "tipo": "torre",
   "nivel": 2,
   "rota": "baixo",
   "equipe": "vermelho",
   "pos": [
    0.8729,
    0.59058
   ]
  },
  {
   "id": "torre_baixo_1_azul",
   "tipo": "torre",
   "nivel": 1,
   "rota": "baixo",
   "equipe": "azul",
   "pos": [
    0.6428,
    0.93362
   ]
  },
  {
   "id": "torre_baixo_1_vermelho",
   "tipo": "torre",
   "nivel": 1,
   "rota": "baixo",
   "equipe": "vermelho",
   "pos": [
    0.87099,
    0.75122
   ]
  },
  {
   "id": "inibidor_baixo_azul",
   "tipo": "inibidor",
   "rota": "baixo",
   "equipe": "azul",
   "pos": [
    0.3682,
    0.90998
   ]
  },
  {
   "id": "inibidor_baixo_vermelho",
   "tipo": "inibidor",
   "rota": "baixo",
   "equipe": "vermelho",
   "pos": [
    0.86771,
    0.362
   ]
  },
  {
   "id": "nexus_azul",
   "tipo": "nexus",
   "equipe": "azul",
   "pos": [
    0.10087,
    0.92628
   ]
  },
  {
   "id": "torre_nexus_1_azul",
   "tipo": "torre",
   "nivel": 4,
   "rota": "nexus",
   "equipe": "azul",
   "pos": [
    0.1466,
    0.85822
   ]
  },
  {
   "id": "torre_nexus_2_azul",
   "tipo": "torre",
   "nivel": 4,
   "rota": "nexus",
   "equipe": "azul",
   "pos": [
    0.17619,
    0.89792
   ]
  },
  {
   "id": "nexus_vermelho",
   "tipo": "nexus",
   "equipe": "vermelho",
   "pos": [
    0.85071,
    0.09924
   ]
  },
  {
   "id": "torre_nexus_1_vermelho",
   "tipo": "torre",
   "nivel": 4,
   "rota": "nexus",
   "equipe": "vermelho",
   "pos": [
    0.81708,
    0.16824
   ]
  },
  {
   "id": "torre_nexus_2_vermelho",
   "tipo": "torre",
   "nivel": 4,
   "rota": "nexus",
   "equipe": "vermelho",
   "pos": [
    0.78816,
    0.13043
   ]
  }
 ],
 "acampamentos": [
  {
   "id": "azul_buff",
   "lado": "azul",
   "tipo": "sentinela",
   "ajustar": true,
   "pos": [
    0.32414,
    0.47448
   ],
   "raio": 0.02017
  },
  {
   "id": "azul_gromp",
   "lado": "azul",
   "tipo": "gromp",
   "ajustar": true,
   "pos": [
    0.2273,
    0.43006
   ],
   "raio": 0.01883
  },
  {
   "id": "azul_lobos",
   "lado": "azul",
   "tipo": "lobos",
   "ajustar": true,
   "pos": [
    0.31742,
    0.57278
   ],
   "raio": 0.02017
  },
  {
   "id": "azul_raptores",
   "lado": "azul",
   "tipo": "raptores",
   "ajustar": true,
   "pos": [
    0.46873,
    0.66257
   ],
   "raio": 0.02017
  },
  {
   "id": "azul_brambleback",
   "lado": "azul",
   "tipo": "brambleback",
   "ajustar": true,
   "pos": [
    0.52925,
    0.75142
   ],
   "raio": 0.02017
  },
  {
   "id": "azul_krugs",
   "lado": "azul",
   "tipo": "krugs",
   "ajustar": true,
   "pos": [
    0.5649,
    0.85066
   ],
   "raio": 0.02017
  },
  {
   "id": "verm_buff",
   "lado": "vermelho",
   "tipo": "sentinela",
   "ajustar": true,
   "pos": [
    0.72024,
    0.55104
   ],
   "raio": 0.02017
  },
  {
   "id": "verm_gromp",
   "lado": "vermelho",
   "tipo": "gromp",
   "ajustar": true,
   "pos": [
    0.82246,
    0.58318
   ],
   "raio": 0.01883
  },
  {
   "id": "verm_lobos",
   "lado": "vermelho",
   "tipo": "lobos",
   "ajustar": true,
   "pos": [
    0.7236,
    0.45369
   ],
   "raio": 0.02017
  },
  {
   "id": "verm_raptores",
   "lado": "vermelho",
   "tipo": "raptores",
   "ajustar": true,
   "pos": [
    0.54001,
    0.37807
   ],
   "raio": 0.02017
  },
  {
   "id": "verm_brambleback",
   "lado": "vermelho",
   "tipo": "brambleback",
   "ajustar": true,
   "pos": [
    0.47949,
    0.28922
   ],
   "raio": 0.02017
  },
  {
   "id": "verm_krugs",
   "lado": "vermelho",
   "tipo": "krugs",
   "ajustar": true,
   "pos": [
    0.44385,
    0.18998
   ],
   "raio": 0.02017
  },
  {
   "id": "caranguejo_topo",
   "lado": "rio",
   "tipo": "caranguejo",
   "ajustar": true,
   "pos": [
    0.32482,
    0.37146
   ],
   "raio": 0.01614
  },
  {
   "id": "caranguejo_baixo",
   "lado": "rio",
   "tipo": "caranguejo",
   "ajustar": true,
   "pos": [
    0.68258,
    0.66919
   ],
   "raio": 0.01614
  }
 ],
 "covis": [
  {
   "id": "barao",
   "tipo": "barao",
   "ajustar": true,
   "pos": [
    0.38601,
    0.32231
   ],
   "raio": 0.03497
  },
  {
   "id": "dragao",
   "tipo": "dragao",
   "ajustar": true,
   "pos": [
    0.67384,
    0.74102
   ],
   "raio": 0.03497
  }
 ]
};
