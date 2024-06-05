import { Request, Response } from "express";
import AbstractController from "./AbstractController";
import db from "../models";
import { Op, where } from "sequelize";

class ReporteController extends AbstractController {
  //Singleton
  //Atributo de clase
  private static _instance: ReporteController;
  //Método de clase
  public static get instance(): AbstractController {
    if (!this._instance) {
      this._instance = new ReporteController("notificacion");
    }
    return this._instance;
  }
  //Declarar todas las rutas del controlador
  protected initRoutes(): void {
    this.router.get("/test", this.getTest.bind(this));
    this.router.post(
      "/crearNotificacion",
      this.postCrearNotificacion.bind(this)
    );
    this.router.get(
      "/consultarNotificaciones",
      this.getConsultarNotificaciones.bind(this)
    );
    this.router.post(
      "/crearNotificacionEsGlobal",
      this.postCrearNotificacionEsGlobal.bind(this)
    );
    this.router.get(
      "/notificacionesDia/:id/:fecha",
      this.notificacionesDia.bind(this)
    );
    this.router.get("/notificaciones", this.notificaciones.bind(this));
    this.router.get("/notificacionesDiaGlobal/:fecha", this.notificacionesDiaGlobal.bind(this));
  }

  private async notificaciones(req: Request, res: Response) {
    try {
      const notificaciones = await db.Notificacion.findAll();
      res.status(200).json(notificaciones);
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error);
    }
  }

  private async notificacionesDiaGlobal(req: Request, res: Response) {
    try {
        try {
            const { fecha } = req.params;

            const fechaISO = `${fecha}T00:00:00.000Z`;
      
            const notificaciones = await db.Notificacion.findAll({
              where: {
                EsGlobal: true,
                FechaHora: {
                    [Op.between]: [fechaISO, new Date(new Date(fechaISO).getTime() + 86400000)] // Agregar 24 horas al final del día
                  }
              }
            });

            if (notificaciones.length === 0) {
                return res
                  .status(404)
                  .send(
                    "No se encontraron notificaciones globales en la fecha especificada"
                  );
              }
        
            res.status(200).json(notificaciones);
      
          } catch (error: any) {
            console.log(error);
            res.status(500).send("Internal server error" + error);
          }

    } catch (error: any) {
        console.log(error);
        res.status(500).send("Internal server error" + error);
    }
  }

  private async notificacionDiaGlobalBandera(fecha: any) {
    try {
      const fechaISO = new Date(fecha);

      const year = fechaISO.getUTCFullYear();
      const month = String(fechaISO.getUTCMonth() + 1).padStart(2, "0"); // Los meses empiezan desde 0
      const day = String(fechaISO.getUTCDate()).padStart(2, "0");
      const fechaSinHora = `${year}-${month}-${day}`;

      const inicioDelDia = new Date(`${fechaSinHora}T00:00:00.000Z`);

      const finDelDia = new Date(inicioDelDia.getTime() + 86400000 - 1);

      const notificaciones = await db.Notificacion.findAll({
        where: {
          EsGlobal: true,
          FechaHora: {
            [Op.between]: [inicioDelDia, finDelDia],
          },
        },
      });

      console.log(notificaciones)
      return notificaciones;

    } catch (err) {
      console.log(err);
      throw new Error("Internal server error" + err);
    }
  }

  private async notificacionesDia(req: Request, res: Response) {
    try {
      const { id, fecha } = req.params;

      const fechaISO = `${fecha}T00:00:00.000Z`;

      const empleado = await db.Empleado.findOne({
        where: { IdEmpleado: id },
      });

      if (!empleado) {
        return res.status(404).send("El empleado no existe");
      }

      const notificaciones = await db.Notificacion.findAll({
        where: {
          IdEmpleado: id,
          FechaHora: {
            [Op.between]: [
              fechaISO,
              new Date(new Date(fechaISO).getTime() + 86400000),
            ], // Agregar 24 horas al final del día
          },
        },
      });

      if (notificaciones.length === 0) {
        return res
          .status(404)
          .send(
            "No se encontraron notificaciones para este empleado en la fecha especificada"
          );
      }

      return res.status(200).json(notificaciones);
    } catch (error) {
      console.error(error);
      return res.status(500).send("Error interno del servidor: " + error);
    }
  }

  private async getConsultarNotificaciones(req: Request, res: Response) {
    try {
      const notificaciones = await db.Notificacion.findAll({
        include: [
          {
            model: db.Empleado,
            as: "Empleado",
            attributes: ["Nombre", "ApellidoP", "ApellidoM"],
          },
        ],
      });
      res.status(200).json(notificaciones);
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error);
    }
  }

  private async postCrearNotificacionEsGlobal(req: Request, res: Response) {
    try {
      const { FechaHora, Titulo, Descripcion } = req.body;
      const notificacion = await db.Notificacion.create({
        EsGlobal: true,
        FechaHora,
        Titulo,
        Descripcion,
        IdEmpleado: null,
      });

      // Envia notificacion a todos los empleados
      const io = req.app.get("socketio"); // Web Socket
      if (io) {
        const notificacionesGlobales = await this.notificacionDiaGlobalBandera(FechaHora);
        io.emit("notificacion_global", notificacionesGlobales);
        console.log("Notificación global enviada")
      } else {
        console.log("No se pudo enviar la notificación global")
      }

      res.status(201).json("<h1>Notificación creada con éxito</h1>");
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error);
    }
  }

  private async postCrearNotificacion(req: Request, res: Response) {
    try {
      const { EsGlobal, FechaHora, Titulo, Descripcion, IdEmpleado } = req.body;
      const notificacion = await db.Notificacion.create({
        EsGlobal,
        FechaHora,
        Titulo,
        Descripcion,
        IdEmpleado,
      });
      res.status(201).json("<h1>Notificación creada con éxito</h1>");
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error);
    }
  }

  private getTest(req: Request, res: Response) {
    try {
      console.log("Prueba exitosa");
      res.status(200).send("<h1>Prueba exitosa</h1>");
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error);
    }
  }
}

export default ReporteController;
