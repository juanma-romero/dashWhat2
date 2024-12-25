vamos a concentrarnos primero en la conexion entre baileys y backend. ya habiamos hecho una prueba entre baileys y backend, pero luego modificamos el backend, para hacer la prueba entre back y frontend. Es decir que devemos re-hacer el archivo de backend , teniendo en  cuenta:
* los datos que van a venir de baileys
* los datos que debemos guardar en db, y al mismo tiempo
* los datos que debemos enviar al front (utilizando websocket)
* todo el camino anterior pero hacia baileys, es decir: frontend envia a backend, este guarda en db y reenvia a baileys (con websocket)





// Envía el mensaje a todos los clientes conectados
    io.emit('new-message', { sender, text, timestamp })
    en backend ...envia a whatsap tambien? solo quiero a l front cuando viene de what y hacia what cunado viene de front
    ...no a los dos siempre, duplica mensaje del que envia asi