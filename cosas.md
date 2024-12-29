vamos a concentrarnos primero en la conexion entre baileys y backend. ya habiamos hecho una prueba entre baileys y backend, pero luego modificamos el backend, para hacer la prueba entre back y frontend. Es decir que devemos re-hacer el archivo de backend , teniendo en  cuenta:
* los datos que van a venir de baileys
* los datos que debemos guardar en db, y al mismo tiempo
* los datos que debemos enviar al front (utilizando websocket)
* todo el camino anterior pero hacia baileys, es decir: frontend envia a backend, este guarda en db y reenvia a baileys (con websocket)


no me permite enviar mensajes de voraz/dashWhat a voraz, da error en bayleais pero no se cae app, segun consola backend ahi no hay problema, front se puso pantalla blanca, refresque pagina y estaba el mensaje enviado


***TODO**

mensajes enviados desde celu no se ven 
 o mensajes enviados recibidos con servidor apagado...alguna forma de traer desde whatsap?? 

listado de chat , debe ir arriba el que tiene el mensaje recibido o enviado, mas nuevo 

   graba mensaje enviado en db??

se ve la hora en cada mensaje dentro del chat, pero si no es del dia de hoy deberia verse un banner o algo asi que diga a que fecha corresponde ese sector de chatArea 


se modifico back recibe de baileys, ahora hay que modificar o rovisar como se envia a baileys, tambien como se guarda en db seguramente agregar pushName
cuando se envia a baileys , omo tomamos el id del mensaje?


que en frontend cuando se pida mensajes por canal sea de acuerdo a recipient y a sender ( o sea cuando envia y recibe mensaje un numero debe mandar al chatarea)


estamos guardando en db, los mensajes enviados, sin saber si fueron entregados, tal vez deberia guardarse tras una confirmacion de baileys 