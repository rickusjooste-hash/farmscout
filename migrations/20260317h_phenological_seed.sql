-- Seed phenological stages from crop protection advisor
-- variety_group values match orchards table exactly
INSERT INTO public.phenological_stages (commodity_code, variety_group, month, stage) VALUES
-- Apples: Gala
('AP','Gala',1,'FF'),('AP','Gala',2,'H'),('AP','Gala',3,'H'),('AP','Gala',4,'PH'),('AP','Gala',5,'LF'),('AP','Gala',6,'D'),('AP','Gala',7,'D'),('AP','Gala',8,'D'),('AP','Gala',9,'BB'),('AP','Gala',10,'BL'),('AP','Gala',11,'CD'),('AP','Gala',12,'CD'),
-- Apples: Red
('AP','Red',1,'FF'),('AP','Red',2,'FF'),('AP','Red',3,'H'),('AP','Red',4,'PH'),('AP','Red',5,'LF'),('AP','Red',6,'D'),('AP','Red',7,'D'),('AP','Red',8,'D'),('AP','Red',9,'BB'),('AP','Red',10,'BL'),('AP','Red',11,'CD'),('AP','Red',12,'FF'),
-- Apples: Golden Delcious (DB spelling)
('AP','Golden Delcious',1,'FF'),('AP','Golden Delcious',2,'FF'),('AP','Golden Delcious',3,'H'),('AP','Golden Delcious',4,'PH'),('AP','Golden Delcious',5,'LF'),('AP','Golden Delcious',6,'D'),('AP','Golden Delcious',7,'D'),('AP','Golden Delcious',8,'D'),('AP','Golden Delcious',9,'BB'),('AP','Golden Delcious',10,'BL'),('AP','Golden Delcious',11,'CD'),('AP','Golden Delcious',12,'FF'),
-- Apples: Granny Smith
('AP','Granny Smith',1,'FF'),('AP','Granny Smith',2,'FF'),('AP','Granny Smith',3,'FF'),('AP','Granny Smith',4,'H'),('AP','Granny Smith',5,'LF'),('AP','Granny Smith',6,'D'),('AP','Granny Smith',7,'D'),('AP','Granny Smith',8,'D'),('AP','Granny Smith',9,'BB'),('AP','Granny Smith',10,'BL'),('AP','Granny Smith',11,'CD'),('AP','Granny Smith',12,'FF'),
-- Apples: Early Granny Smith
('AP','Early Granny Smith',1,'FF'),('AP','Early Granny Smith',2,'FF'),('AP','Early Granny Smith',3,'H'),('AP','Early Granny Smith',4,'PH'),('AP','Early Granny Smith',5,'LF'),('AP','Early Granny Smith',6,'D'),('AP','Early Granny Smith',7,'D'),('AP','Early Granny Smith',8,'D'),('AP','Early Granny Smith',9,'BB'),('AP','Early Granny Smith',10,'BL'),('AP','Early Granny Smith',11,'CD'),('AP','Early Granny Smith',12,'FF'),
-- Apples: Pink Lady
('AP','Pink Lady',1,'FF'),('AP','Pink Lady',2,'FF'),('AP','Pink Lady',3,'FF'),('AP','Pink Lady',4,'H'),('AP','Pink Lady',5,'LF'),('AP','Pink Lady',6,'D'),('AP','Pink Lady',7,'D'),('AP','Pink Lady',8,'D'),('AP','Pink Lady',9,'BB'),('AP','Pink Lady',10,'BL'),('AP','Pink Lady',11,'CD'),('AP','Pink Lady',12,'FF'),
-- Apples: Cripps Pink
('AP','Cripps Pink',1,'FF'),('AP','Cripps Pink',2,'FF'),('AP','Cripps Pink',3,'FF'),('AP','Cripps Pink',4,'H'),('AP','Cripps Pink',5,'LF'),('AP','Cripps Pink',6,'D'),('AP','Cripps Pink',7,'D'),('AP','Cripps Pink',8,'D'),('AP','Cripps Pink',9,'BB'),('AP','Cripps Pink',10,'BL'),('AP','Cripps Pink',11,'CD'),('AP','Cripps Pink',12,'FF'),
-- Apples: Cripps Red
('AP','Cripps Red',1,'FF'),('AP','Cripps Red',2,'FF'),('AP','Cripps Red',3,'FF'),('AP','Cripps Red',4,'H'),('AP','Cripps Red',5,'LF'),('AP','Cripps Red',6,'D'),('AP','Cripps Red',7,'D'),('AP','Cripps Red',8,'D'),('AP','Cripps Red',9,'BB'),('AP','Cripps Red',10,'BL'),('AP','Cripps Red',11,'CD'),('AP','Cripps Red',12,'FF'),
-- Apples: Fuji
('AP','Fuji',1,'FF'),('AP','Fuji',2,'FF'),('AP','Fuji',3,'FF'),('AP','Fuji',4,'H'),('AP','Fuji',5,'LF'),('AP','Fuji',6,'D'),('AP','Fuji',7,'D'),('AP','Fuji',8,'D'),('AP','Fuji',9,'BB'),('AP','Fuji',10,'BL'),('AP','Fuji',11,'CD'),('AP','Fuji',12,'FF'),
-- Apples: PGDL
('AP','PGDL',1,'FF'),('AP','PGDL',2,'FF'),('AP','PGDL',3,'H'),('AP','PGDL',4,'PH'),('AP','PGDL',5,'LF'),('AP','PGDL',6,'D'),('AP','PGDL',7,'D'),('AP','PGDL',8,'D'),('AP','PGDL',9,'BB'),('AP','PGDL',10,'BL'),('AP','PGDL',11,'CD'),('AP','PGDL',12,'FF'),
-- Pears: Forelle
('PR','Forelle',1,'FF'),('PR','Forelle',2,'FF'),('PR','Forelle',3,'H'),('PR','Forelle',4,'PH'),('PR','Forelle',5,'LF'),('PR','Forelle',6,'D'),('PR','Forelle',7,'D'),('PR','Forelle',8,'D'),('PR','Forelle',9,'BB'),('PR','Forelle',10,'BL'),('PR','Forelle',11,'CD'),('PR','Forelle',12,'FF'),
-- Pears: Packhams Triumph
('PR','Packhams Triumph',1,'FF'),('PR','Packhams Triumph',2,'H'),('PR','Packhams Triumph',3,'H'),('PR','Packhams Triumph',4,'PH'),('PR','Packhams Triumph',5,'LF'),('PR','Packhams Triumph',6,'D'),('PR','Packhams Triumph',7,'D'),('PR','Packhams Triumph',8,'D'),('PR','Packhams Triumph',9,'BB'),('PR','Packhams Triumph',10,'BL'),('PR','Packhams Triumph',11,'CD'),('PR','Packhams Triumph',12,'FF'),
-- Pears: Early BC
('PR','Early BC',1,'FF'),('PR','Early BC',2,'H'),('PR','Early BC',3,'PH'),('PR','Early BC',4,'PH'),('PR','Early BC',5,'LF'),('PR','Early BC',6,'D'),('PR','Early BC',7,'D'),('PR','Early BC',8,'D'),('PR','Early BC',9,'BB'),('PR','Early BC',10,'BL'),('PR','Early BC',11,'CD'),('PR','Early BC',12,'CD'),
-- Pears: WBC
('PR','WBC',1,'FF'),('PR','WBC',2,'H'),('PR','WBC',3,'PH'),('PR','WBC',4,'PH'),('PR','WBC',5,'LF'),('PR','WBC',6,'D'),('PR','WBC',7,'D'),('PR','WBC',8,'D'),('PR','WBC',9,'BB'),('PR','WBC',10,'BL'),('PR','WBC',11,'CD'),('PR','WBC',12,'FF'),
-- Pears: RSM (Rosemarie - very early Jan harvest)
('PR','RSM',1,'H'),('PR','RSM',2,'PH'),('PR','RSM',3,'PH'),('PR','RSM',4,'LF'),('PR','RSM',5,'LF'),('PR','RSM',6,'D'),('PR','RSM',7,'D'),('PR','RSM',8,'D'),('PR','RSM',9,'BB'),('PR','RSM',10,'BL'),('PR','RSM',11,'CD'),('PR','RSM',12,'FF'),
-- Pears: ABATA
('PR','ABATA',1,'FF'),('PR','ABATA',2,'FF'),('PR','ABATA',3,'H'),('PR','ABATA',4,'PH'),('PR','ABATA',5,'LF'),('PR','ABATA',6,'D'),('PR','ABATA',7,'D'),('PR','ABATA',8,'D'),('PR','ABATA',9,'BB'),('PR','ABATA',10,'BL'),('PR','ABATA',11,'CD'),('PR','ABATA',12,'FF'),
-- Nectarines: Alpine
('NE','Alpine',1,'H'),('NE','Alpine',2,'PH'),('NE','Alpine',3,'PH'),('NE','Alpine',4,'LF'),('NE','Alpine',5,'LF'),('NE','Alpine',6,'D'),('NE','Alpine',7,'D'),('NE','Alpine',8,'BB'),('NE','Alpine',9,'BL'),('NE','Alpine',10,'CD'),('NE','Alpine',11,'CD'),('NE','Alpine',12,'FF'),
-- Nectarines: ALPINE (duplicate casing in DB)
('NE','ALPINE',1,'H'),('NE','ALPINE',2,'PH'),('NE','ALPINE',3,'PH'),('NE','ALPINE',4,'LF'),('NE','ALPINE',5,'LF'),('NE','ALPINE',6,'D'),('NE','ALPINE',7,'D'),('NE','ALPINE',8,'BB'),('NE','ALPINE',9,'BL'),('NE','ALPINE',10,'CD'),('NE','ALPINE',11,'CD'),('NE','ALPINE',12,'FF'),
-- Nectarines: August Red
('NE','August Red',1,'FF'),('NE','August Red',2,'FF'),('NE','August Red',3,'H'),('NE','August Red',4,'PH'),('NE','August Red',5,'LF'),('NE','August Red',6,'D'),('NE','August Red',7,'D'),('NE','August Red',8,'BB'),('NE','August Red',9,'BL'),('NE','August Red',10,'CD'),('NE','August Red',11,'FF'),('NE','August Red',12,'FF'),
-- Nectarines: Fantasia
('NE','Fantasia',1,'FF'),('NE','Fantasia',2,'H'),('NE','Fantasia',3,'PH'),('NE','Fantasia',4,'LF'),('NE','Fantasia',5,'LF'),('NE','Fantasia',6,'D'),('NE','Fantasia',7,'D'),('NE','Fantasia',8,'BB'),('NE','Fantasia',9,'BL'),('NE','Fantasia',10,'CD'),('NE','Fantasia',11,'FF'),('NE','Fantasia',12,'FF'),
-- Nectarines: Garofa
('NE','Garofa',1,'H'),('NE','Garofa',2,'PH'),('NE','Garofa',3,'PH'),('NE','Garofa',4,'LF'),('NE','Garofa',5,'LF'),('NE','Garofa',6,'D'),('NE','Garofa',7,'D'),('NE','Garofa',8,'BB'),('NE','Garofa',9,'BL'),('NE','Garofa',10,'CD'),('NE','Garofa',11,'CD'),('NE','Garofa',12,'FF'),
-- Nectarines: Honey Spring (very early Dec harvest)
('NE','Honey Spring',1,'PH'),('NE','Honey Spring',2,'PH'),('NE','Honey Spring',3,'LF'),('NE','Honey Spring',4,'LF'),('NE','Honey Spring',5,'D'),('NE','Honey Spring',6,'D'),('NE','Honey Spring',7,'D'),('NE','Honey Spring',8,'BB'),('NE','Honey Spring',9,'BL'),('NE','Honey Spring',10,'CD'),('NE','Honey Spring',11,'FF'),('NE','Honey Spring',12,'H'),
-- Nectarines: Luciana
('NE','Luciana',1,'FF'),('NE','Luciana',2,'H'),('NE','Luciana',3,'PH'),('NE','Luciana',4,'LF'),('NE','Luciana',5,'LF'),('NE','Luciana',6,'D'),('NE','Luciana',7,'D'),('NE','Luciana',8,'BB'),('NE','Luciana',9,'BL'),('NE','Luciana',10,'CD'),('NE','Luciana',11,'FF'),('NE','Luciana',12,'FF'),
-- Nectarines: Primrose (very early Dec harvest)
('NE','Primrose',1,'PH'),('NE','Primrose',2,'PH'),('NE','Primrose',3,'LF'),('NE','Primrose',4,'LF'),('NE','Primrose',5,'D'),('NE','Primrose',6,'D'),('NE','Primrose',7,'D'),('NE','Primrose',8,'BB'),('NE','Primrose',9,'BL'),('NE','Primrose',10,'CD'),('NE','Primrose',11,'FF'),('NE','Primrose',12,'H'),
-- Nectarines: Sunburst
('NE','Sunburst',1,'FF'),('NE','Sunburst',2,'H'),('NE','Sunburst',3,'PH'),('NE','Sunburst',4,'LF'),('NE','Sunburst',5,'LF'),('NE','Sunburst',6,'D'),('NE','Sunburst',7,'D'),('NE','Sunburst',8,'BB'),('NE','Sunburst',9,'BL'),('NE','Sunburst',10,'CD'),('NE','Sunburst',11,'FF'),('NE','Sunburst',12,'FF'),
-- Nectarines: Tiffany
('NE','Tiffany',1,'FF'),('NE','Tiffany',2,'FF'),('NE','Tiffany',3,'H'),('NE','Tiffany',4,'PH'),('NE','Tiffany',5,'LF'),('NE','Tiffany',6,'D'),('NE','Tiffany',7,'D'),('NE','Tiffany',8,'BB'),('NE','Tiffany',9,'BL'),('NE','Tiffany',10,'CD'),('NE','Tiffany',11,'FF'),('NE','Tiffany',12,'FF'),
-- Peaches: Summersun
('PE','Summersun',1,'FF'),('PE','Summersun',2,'H'),('PE','Summersun',3,'PH'),('PE','Summersun',4,'LF'),('PE','Summersun',5,'LF'),('PE','Summersun',6,'D'),('PE','Summersun',7,'D'),('PE','Summersun',8,'BB'),('PE','Summersun',9,'BL'),('PE','Summersun',10,'CD'),('PE','Summersun',11,'FF'),('PE','Summersun',12,'FF'),
-- Peaches: Temptation (very early Dec harvest)
('PE','Temptation',1,'PH'),('PE','Temptation',2,'PH'),('PE','Temptation',3,'LF'),('PE','Temptation',4,'LF'),('PE','Temptation',5,'D'),('PE','Temptation',6,'D'),('PE','Temptation',7,'D'),('PE','Temptation',8,'BB'),('PE','Temptation',9,'BL'),('PE','Temptation',10,'CD'),('PE','Temptation',11,'FF'),('PE','Temptation',12,'H')
ON CONFLICT (commodity_code, variety_group, month) DO UPDATE SET stage = EXCLUDED.stage;
