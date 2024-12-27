vamos a concentrarnos primero en la conexion entre baileys y backend. ya habiamos hecho una prueba entre baileys y backend, pero luego modificamos el backend, para hacer la prueba entre back y frontend. Es decir que devemos re-hacer el archivo de backend , teniendo en  cuenta:
* los datos que van a venir de baileys
* los datos que debemos guardar en db, y al mismo tiempo
* los datos que debemos enviar al front (utilizando websocket)
* todo el camino anterior pero hacia baileys, es decir: frontend envia a backend, este guarda en db y reenvia a baileys (con websocket)


no me permite enviar mensajes de voraz/dashWhat a voraz, da error en bayleais pero no se cae app, segun consola backend ahi no hay problema, front se puso pantalla blanca, refresque pagina y estaba el mensaje enviado


***TODO**

mensajes enviados desde celu no se ven 
 o mensajes enviados recibidos con servidor apagado...alguna forma de traer desde whatsap?? 

listado de chat , debe ir arriba el que tiene el mensaje recibido o enviado, mas nuevo. 
    respuesta: cuando abria app, llamaba a db y lo que traia lo ponia en ui, sin orde...a medida que ivan entrando mensajes los ordenaba bien. pero los que vienen de db no
                algo se modifico para ordenar lo que viene de db. pero hay un problema con el diferencia de tiempo entre timestamp de bailes y el de pc


id unico de cada mensaje (independientemente de quien envie, para poner en chatArea)

   mensajes duplicados , aparecen arriba en vez de abajo, sobreposicion de mensajes parta baja del chat, no aparecen mensajes enviados desde voraz

   logear un mensaje de baileys, guardarlo para analizar la info que manda

   buscar como poner imagen de usuario y nombre en chat

   buscar que otro future ademas de establecer estados en chat podria servir para comercios
   creo que cuando manda mensaje voraz no resetea field
   
// todo desde archivo index.d.ts carpeta WAProto linea 23400
//  remoteJid?: (string|null);
//  id?: (string|null);
//  fromMe?: (boolean|null);
/** MessageKey id. */
//  public id: string;

    